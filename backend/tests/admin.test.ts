import request from "supertest";
import app from "../src/app"; // Express アプリ
import { execSync } from "child_process";
import { env } from "../src/config/env";

describe("Admin API (Local)", () => {
  const randomNumber1 = Math.floor(10000000 + Math.random() * 90000000);
  const randomNumber2 = Math.floor(10000000 + Math.random() * 90000000);

  const adminEmail = `admin${randomNumber1}@example.com`;
  const adminPassword = "Passw0rd!";
  const targetEmail = `user${randomNumber2}@example.com`;
  const targetPassword = "Passw0rd!";

  let adminToken = "";
  let targetToken = "";

  // 1. 管理者ユーザー作成
  beforeAll(async () => {
    // Adminユーザー作成
    await request(app).post("/auth/signup").send({
      email: adminEmail,
      password: adminPassword,
    });
    await request(app).get(
      `/auth/confirm?email=${encodeURIComponent(adminEmail)}&code=999999`
    );

    const loginRes = await request(app).post("/auth/login").send({
      email: adminEmail,
      password: adminPassword,
    });
    adminToken = loginRes.body.accessToken;

    const listUsersOutput = execSync(
      `
  aws cognito-idp list-users \
    --user-pool-id ${env.COGNITO_USER_POOL_ID} \
    --filter "email=\\"${adminEmail}\\"" \
    --endpoint-url http://localhost:5001 \
    --region us-east-1
`,
      { encoding: "utf-8" }
    );

    const listUsers = JSON.parse(listUsersOutput);
    const username = listUsers.Users?.[0]?.Username;

    // Admin権限付与 (CLI 実行)
    execSync(`
      aws cognito-idp admin-update-user-attributes \
        --user-pool-id ${env.COGNITO_USER_POOL_ID} \
        --username ${username} \
        --user-attributes Name="custom:isAdmin",Value="true" \
        --endpoint-url http://localhost:5001 \
        --region us-east-1
    `);

    // 操作対象ユーザー作成
    await request(app).post("/auth/signup").send({
      email: targetEmail,
      password: targetPassword,
    });
    await request(app).get(
      `/auth/confirm?email=${encodeURIComponent(targetEmail)}&code=999999`
    );

    const targetLoginRes = await request(app).post("/auth/login").send({
      email: targetEmail,
      password: targetPassword,
    });
    targetToken = targetLoginRes.body.accessToken;
  }, 30000);

  // ユーザー一覧取得
  it("should get user list as admin", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // 一覧取得不可
  it("should not get user list as admin", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${targetToken}`);
    expect(res.statusCode).toBe(403);
  });

  // 権限付与
  it("should promote and demote a user", async () => {
    let res = await request(app)
      .post("/admin/promote")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: targetEmail });
    expect(res.statusCode).toBe(200);
  });

  // 一覧取得可能
  it("should get user list as admin", async () => {
    const res = await request(app)
      .get("/admin/users")
      .set("Authorization", `Bearer ${targetToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // 権限剥奪
  it("should demote a user", async () => {
    const res = await request(app)
      .post("/admin/demote")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: targetEmail });
    expect(res.statusCode).toBe(200);
  });

  it("delete user", async () => {
    const res = await request(app)
      .post("/admin/delete")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: targetEmail });
    expect(res.statusCode).toBe(200);
  });

  it("delete admin", async () => {
    const res = await request(app)
      .post("/auth/delete")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });
});
