// Cuenta del usuario que inicio sesion: /api/account
import express from "express";

import * as account from "./account.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.put("/", account.updateAccount);
router.put("/password", account.changePassword);
router.delete("/", account.deleteAccount);
router.get("/export", account.exportData); // derecho de acceso (habeas data)
router.post("/resend-verification", account.resendVerification);

export default router;
