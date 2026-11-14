// Rutas del administrador: /api/admin/...
import express from "express";

import * as admin from "./admin.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const router = express.Router();

router.use(authenticate, requireRole("ADMIN"));

router.get("/metrics", admin.metrics); // panel de metricas
router.get("/audit", admin.listAudit); // registro de auditoria
router.get("/users", admin.listUsers); // AN-38
router.get("/users/:id/license-doc", admin.downloadLicenseDoc); // AN-35
router.patch("/users/:id/approve", admin.approveUser); // AN-35
router.patch("/users/:id/reject", admin.rejectUser); // AN-35
router.patch("/users/:id/suspend", admin.suspendUser); // AN-37
router.patch("/users/:id/reactivate", admin.reactivateUser); // AN-37

export default router;
