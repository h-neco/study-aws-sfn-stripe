import { Request, Response } from "express";
import { AuthRequest } from "../types/AuthRequest";
import {
  signupCognitoUser,
  loginCognitoUser,
  logoutCognitoUser,
  confirmCognitoUser,
  approveCognitoUser,
  changeCognitoPassword,
  updateCognitoEmail,
  listCognitoUsers,
  deleteCognitoUserById,
  refreshToken,
} from "../services/cognitoService";
import { saveLog } from "../services/dynamoService";
import { sendMail } from "../services/mailService";
import { env } from "../config/env";

/**
 * サインアップ
 */
export const signup = async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    await signupCognitoUser(email, password);

    if (env.TARGET_ENV === "local") {
      // 📩 確認リンクを生成
      const confirmLink = `http://localhost:3000/auth/confirm?email=${encodeURIComponent(
        email
      )}&code=999999`; // ローカル用のコード

      // 📤 確認メール送信
      await sendMail(
        email,
        "【ご確認ください】アカウントの有効化",
        `<p>以下のリンクをクリックして登録を完了してください。</p>
           <a href="${confirmLink}">${confirmLink}</a>`
      );
      console.log(`確認メールを送信しました: ${confirmLink}`);
    }

    await saveLog(email, "signup");
    res.status(200).json({ message: "確認メール発行しました" });
  } catch (error: any) {
    res.status(400).json({
      error: error.message || "Unknown error",
    });
  }
};

/**
 * 確認 (GET /auth/confirm?email=xxx&code=yyy)
 */
export const confirmSignup = async (req: Request, res: Response) => {
  const email = req.query.email as string | undefined;
  const code = req.query.code as string | undefined;

  if (!email || !code) {
    return res.status(400).json({ error: "email and code are required" });
  }

  try {
    if (env.TARGET_ENV === "local") {
      // ローカルでもCognito上でCONFIRMEDにする
      await approveCognitoUser(email);
    } else {
      // 本番はCognitoの確認コードで承認
      await confirmCognitoUser(email, code);
    }

    await saveLog(email, "approve");
    // ?confirmed=true を付与してフロントで「登録完了」を表示できる
    res.redirect(`${env.FRONTEND_URL}/login?confirmed=true&email=${email}`);
  } catch (error: any) {
    // 失敗時はエラーページやログイン画面にリダイレクト
    res.redirect(`${env.FRONTEND_URL}/login?confirmed=false`);
  }
};

/**
 * ログイン
 */
export const login = async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    const result = await loginCognitoUser(email, password);
    await saveLog(email, "login");
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
    });
    res.json({ accessToken: result.accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
};

/**
 * ログアウト
 */
export const logout = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId!;
  const { accessToken } = req.body;
  try {
    const result = await logoutCognitoUser(accessToken);
    await saveLog(userId, "logout");

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
};

/**
 * 退会処理
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId!;
  try {
    const users = await listCognitoUsers();
    const targetUser = users.find((u) =>
      u.Attributes?.some((a) => a.Name === "sub" && a.Value === userId)
    );
    if (!targetUser) throw new Error("User not found");
    const result = deleteCognitoUserById(targetUser.Username!);
    await saveLog(userId, "delete");
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
};

/**
 * メールアドレス変更
 */
export const updateEmail = async (req: AuthRequest, res: Response) => {
  const { newEmail, accessToken } = req.body;
  const userId = req.user!.userId;

  if (!newEmail || !accessToken) {
    return res
      .status(400)
      .json({ error: "newEmail, accessToken, and email are required" });
  }

  try {
    // local なら確認コード固定
    let confirmationCode = "999999";

    if (env.TARGET_ENV !== "local") {
      // 本番: Cognito に更新リクエスト（Cognito がメール送信）
      await updateCognitoEmail(accessToken, newEmail);
    } else {
      // local 環境は MailHog に確認メールを送る
      const confirmLink = `http://localhost:3000/auth/email-change-confirm?newEmail=${encodeURIComponent(
        newEmail
      )}&accessToken=${encodeURIComponent(accessToken)}`;

      await sendMail(
        newEmail,
        "【メール変更確認】リンクをクリックしてください",
        `以下のリンクでメール変更を承認してください\n\n
        ${confirmLink}`
      );
    }

    await saveLog(userId, "updateEmail", { newEmail });
    res.json({
      message: "Confirmation mail sent",
      confirmationCode:
        env.TARGET_ENV === "local" ? confirmationCode : undefined,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update email" });
  }
};

/**
 * メールアドレス確認
 * @param req
 * @param res
 * @returns
 */
export const updateEmailConfirm = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const accessToken = req.query.accessToken as string | undefined;
  const newEmail = req.query.newEmail as string | undefined;

  if (!newEmail || !accessToken) {
    return res.status(400).json({ error: "email, accessToken are required" });
  }

  try {
    await updateCognitoEmail(accessToken, newEmail);
    await saveLog(userId, "updateEmail", { newEmail });
    res.redirect(`${env.FRONTEND_URL}/user/dashboard`);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.message || "Failed to confirm email change" });
  }
};

/**
 * パスワード変更
 */
export const updatePassword = async (req: AuthRequest, res: Response) => {
  const { previousPassword, proposedPassword } = req.body;
  const userId = req.user!.userId;
  const accessToken = req.headers.authorization?.split(" ")[1];

  if (!previousPassword || !proposedPassword || !accessToken) {
    return res.status(400).json({
      error:
        "previousPassword and proposedPassword are required, and Authorization header must be set",
    });
  }

  try {
    await changeCognitoPassword(
      accessToken,
      previousPassword,
      proposedPassword
    );
    await saveLog(userId, "changePassword");
    res.json({ message: `パスワードが変更されました` });
  } catch (error: any) {
    res
      .status(400)
      .json({ error: error.message || "Failed to change password" });
  }
};

/*
 * refreshTokens
 */
export const refreshTokens = async (req: Request, res: Response) => {
  const refreshTokenValue = req.cookies.refreshToken;
  console.log(refreshTokenValue);
  if (!refreshTokenValue) {
    return res.status(401).json({ error: "Refresh token missing" });
  }
  try {
    const result = await refreshToken(refreshTokenValue);
    res.json(result?.AccessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
};
