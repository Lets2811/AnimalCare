import express from "express";

import { register, login, logout, logoutAll, me } from "./auth.controller";
import { forgotPassword, resetPassword, verifyEmail } from "../account/account.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { loginLimiter, forgotLimiter, registerLimiter } from "../../middleware/security.middleware";

const router = express.Router();

// Rutas publicas
router.post("/register", registerLimiter, register);
// Maximo 5 intentos fallidos por IP y correo cada 15 minutos.
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

// Recuperacion de contrasena y verificacion de correo.
router.post("/forgot-password", forgotLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-email", verifyEmail);

// Ruta privada: requiere JWT valido
router.get("/me", authenticate, me);
router.post("/logout-all", authenticate, logoutAll);

export default router;
