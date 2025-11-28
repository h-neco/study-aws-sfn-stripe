import { Response } from "express";
import { AuthRequest } from "../types/AuthRequest";
import {
  listCognitoUsers,
  deleteCognitoUserByEmail,
} from "../services/cognitoService";
import { saveLog } from "../services/dynamoService";
import { makeUserAdmin, removeUserAdmin } from "../services/cognitoService";

/**
 * ユーザー一覧取得
 */
export const getUserList = async (req: AuthRequest, res: Response) => {
  try {
    const users = await listCognitoUsers();
    res.json(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
};

/**
 * ユーザー削除
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  const { email } = req.body;
  const userId = req.user?.userId!;
  try {
    const result = await deleteCognitoUserByEmail(email);
    await saveLog(userId, "delete", {
      targetEmail: email,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ error: message });
  }
};

/**
 * 管理者付与
 */
export const promoteToAdmin = async (req: AuthRequest, res: Response) => {
  const { email } = req.body;
  const userId = req.user?.userId!;

  try {
    const result = await makeUserAdmin(email);
    await saveLog(userId, "promoteAdmin", {
      targetEmail: email,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * 管理者剥奪
 */
export const demoteAdmin = async (req: AuthRequest, res: Response) => {
  const { email } = req.body;
  const userId = req.user?.userId!;

  try {
    const result = await removeUserAdmin(email);

    await saveLog(userId, "demoteAdmin", {
      targetEmail: email,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
