import express from "express";
import { login, register, logout, getUser, forgotPassword, resetPassword } from "../controllers/userController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/logout", isAuthenticated, logout);
router.get("/getuser", isAuthenticated, getUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;