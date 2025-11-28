import express from "express";
import {
  getUserList,
  deleteUser,
  promoteToAdmin,
  demoteAdmin,
} from "../controllers/adminController";
import {
  authMiddleware,
  requireAdminMiddleware,
} from "../utils/authMiddleware";

const router = express.Router();
router.get("/users", authMiddleware, requireAdminMiddleware, getUserList);
router.post("/delete", authMiddleware, requireAdminMiddleware, deleteUser);
router.post("/promote", authMiddleware, requireAdminMiddleware, promoteToAdmin);
router.post("/demote", authMiddleware, requireAdminMiddleware, demoteAdmin);

export default router;
