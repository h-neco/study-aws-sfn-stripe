import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../config/env";

interface AuthRequest extends Request {
  user?: {
    userId: string;
    isAdmin: boolean;
  };
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: env.AWS_REGION,
  endpoint: env.COGNITO_ENDPOINT, // localstack の場合はここが使われる
});

/**
 * 共通認証ミドルウェア
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // まず Authorization ヘッダーを読む
  let token = req.headers.authorization?.split(" ")[1];

  // もしヘッダーが無い場合、クエリパラメータの accessToken を使う
  if (!token && req.query.accessToken) {
    token = String(req.query.accessToken);
  }
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload: any = jwt.decode(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }

    let isAdmin = payload["custom:isAdmin"] === "true";

    // ─────────────────────────────────────────
    // ⭐ Local only (localstack の場合は custom 属性が token に載らない)
    // ─────────────────────────────────────────
    if (env.TARGET_ENV === "local") {
      try {
        const cmd = new AdminGetUserCommand({
          UserPoolId: env.COGNITO_USER_POOL_ID,
          Username: payload.username,
        });

        const result = await cognitoClient.send(cmd);
        const attrs: Record<string, string> = {};
        for (const a of result.UserAttributes || []) {
          if (a.Name) {
            attrs[a.Name] = a.Value ?? "";
          }
        }
        isAdmin = attrs["custom:isAdmin"] === "true";
      } catch (error) {
        console.error("AdminGetUser error (local only):", error);
      }
    }

    req.user = {
      userId: payload.sub,
      isAdmin: isAdmin,
    };

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Admin 権限チェック
 */
export function requireAdminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}
