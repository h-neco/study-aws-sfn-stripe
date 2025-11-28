// authRoutes.ts
import { Router } from "express";
import * as authController from "../controllers/authController";
import { authMiddleware } from "../utils/authMiddleware";

const router = Router();
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/logout", authMiddleware, authController.logout);
router.post("/delete", authMiddleware, authController.deleteUser);
router.get("/confirm", authController.confirmSignup);
router.post("/update-email", authMiddleware, authController.updateEmail);
router.get(
  "/email-change-confirm",
  authMiddleware,
  authController.updateEmailConfirm
);
router.post("/update-password", authMiddleware, authController.updatePassword);
router.post("/refresh-tokens", authController.refreshTokens);

export default router;
