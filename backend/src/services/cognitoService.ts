import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  AdminDeleteUserCommand,
  AdminConfirmSignUpCommand,
  ListUsersCommand,
  AuthFlowType,
  ConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
  ChangePasswordCommand,
  UpdateUserAttributesCommand,
  SignUpCommandOutput,
  ChangePasswordCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../config/env";
import { v4 as uuid } from "uuid";

const client = new CognitoIdentityProviderClient({
  region: env.AWS_REGION,
  endpoint: env.COGNITO_ENDPOINT,
});

/**
 * ユーザー登録
 * Username は UUID に固定、email は属性として登録
 */
export async function signupCognitoUser(
  email: string,
  password: string
): Promise<SignUpCommandOutput> {
  const command = new SignUpCommand({
    ClientId: env.COGNITO_CLIENT_ID!,
    Username: uuid(), // 内部識別用
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
  return await client.send(command);
}

/**
 * サインアップ確認
 * Cognito は email での確認をサポートしないため、事前に ListUsers で Username を取得
 */
export async function confirmCognitoUser(email: string, code: string) {
  // Username を email から取得
  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`,
    })
  );
  const user = users.Users?.[0];
  if (!user || !user.Username) throw new Error("ユーザーが見つかりません");

  const command = new ConfirmSignUpCommand({
    ClientId: env.COGNITO_CLIENT_ID,
    Username: user.Username,
    ConfirmationCode: code,
  });
  await client.send(command);
  return { message: `User ${email} confirmed successfully` };
}

/**
 * ログイン
 */
export async function loginCognitoUser(email: string, password: string) {
  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`,
    })
  );
  const user = users.Users?.[0];
  if (!user || !user.Username) throw new Error("ユーザーが見つかりません");

  const command = new InitiateAuthCommand({
    AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
    ClientId: env.COGNITO_CLIENT_ID,
    AuthParameters: {
      USERNAME: user.Username,
      PASSWORD: password,
    },
  });
  const response = await client.send(command);
  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    idToken: response.AuthenticationResult?.IdToken,
    refreshToken: response.AuthenticationResult?.RefreshToken,
  };
}

/**
 * ログアウト
 */
export async function logoutCognitoUser(accessToken: string) {
  const command = new GlobalSignOutCommand({ AccessToken: accessToken });
  await client.send(command);
  return { message: "User logged out successfully" };
}

/**
 * Cognito ユーザー削除（Username = userId）
 */
export async function deleteCognitoUserById(userId: string) {
  if (!userId) throw new Error("UserId is required");

  const command = new AdminDeleteUserCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Username: userId,
  });

  await client.send(command);
  return { message: `User ${userId} deleted successfully` };
}

/**
 * ユーザー削除
 */
export async function deleteCognitoUserByEmail(email: string) {
  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`,
    })
  );
  const user = users.Users?.[0];
  if (!user || !user.Username) throw new Error("ユーザーが見つかりません");

  console.log(user.Username);

  const command = new AdminDeleteUserCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Username: user.Username,
  });
  return await client.send(command);
}

/**
 * ユーザー一覧
 */
export async function listCognitoUsers() {
  const command = new ListUsersCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Limit: 50,
  });
  const response = await client.send(command);
  return response.Users || [];
}

/**
 * 管理者承認
 */
export async function approveCognitoUser(email: string) {
  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`,
    })
  );
  const user = users.Users?.[0];
  if (!user || !user.Username) throw new Error("ユーザーが見つかりません");

  const command = new AdminConfirmSignUpCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Username: user.Username,
  });
  await client.send(command);
  return { message: `User ${email} approved successfully` };
}

/**
 * 管理者権限付与/剥奪
 */
export async function makeUserAdmin(email: string) {
  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`,
    })
  );
  const user = users.Users?.[0];
  if (!user || !user.Username) throw new Error("ユーザーが見つかりません");

  const command = new AdminUpdateUserAttributesCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Username: user.Username,
    UserAttributes: [{ Name: "custom:isAdmin", Value: "true" }],
  });
  await client.send(command);
  return { message: `User ${email} is now admin` };
}

export async function removeUserAdmin(email: string) {
  const users = await client.send(
    new ListUsersCommand({
      UserPoolId: env.COGNITO_USER_POOL_ID,
      Filter: `email = "${email}"`,
    })
  );
  const user = users.Users?.[0];
  if (!user || !user.Username) throw new Error("ユーザーが見つかりません");

  const command = new AdminUpdateUserAttributesCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Username: user.Username,
    UserAttributes: [{ Name: "custom:isAdmin", Value: "false" }],
  });
  await client.send(command);
  return { message: `User ${email} admin removed` };
}

/**
 * パスワード変更
 */
export async function changeCognitoPassword(
  accessToken: string,
  previousPassword: string,
  proposedPassword: string
): Promise<ChangePasswordCommandOutput> {
  const command = new ChangePasswordCommand({
    AccessToken: accessToken,
    PreviousPassword: previousPassword,
    ProposedPassword: proposedPassword,
  });
  return await client.send(command);
}

/**
 * メールアドレス変更
 */
export async function updateCognitoEmail(
  accessToken: string,
  newEmail: string
) {
  const command = new UpdateUserAttributesCommand({
    AccessToken: accessToken,
    UserAttributes: [{ Name: "email", Value: newEmail }],
  });
  return await client.send(command);
}

/**
 * リフレッシュトークン
 * @param refreshToken
 * @returns
 */
export async function refreshToken(refreshToken: string) {
  const res = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: env.COGNITO_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })
  );

  return res.AuthenticationResult;
}
