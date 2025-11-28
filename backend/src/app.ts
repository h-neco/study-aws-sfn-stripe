import express from "express";
import dotenv from "dotenv";
import cors from "cors"; // ← 追加
import authRouter from "./routes/authRoutes";
import adminRouter from "./routes/adminRoutes";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // Vite の URL
    credentials: true,
  })
);

app.use(express.json(), cookieParser());

app.options("*", cors()); // ← preflight 失敗する場合の保険

app.use("/auth", authRouter);
app.use("/admin", adminRouter);

export default app;
