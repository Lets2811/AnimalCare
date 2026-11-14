// Historias clinicas: /api/medical-records  (AN-18, AN-19, AN-20, AN-21)
import express from "express";

import * as records from "./medicalRecord.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const router = express.Router();

router.use(authenticate);

// Dueño (AN-21) y veterinario con cita con la mascota.
router.get("/pets/:petId", requireRole("CLIENT", "VETERINARIAN"), records.getPetHistory);
router.get("/pets/:petId/pdf", requireRole("CLIENT", "VETERINARIAN"), records.downloadHistoryPdf);
router.get("/pets/:petId/accesses", requireRole("CLIENT"), records.listAccesses); // transparencia: quien consulto la historia
router.get("/:id/prescription.pdf", requireRole("CLIENT", "VETERINARIAN"), records.downloadPrescriptionPdf);

// Solo el veterinario escribe en la historia.
router.post("/", requireRole("VETERINARIAN"), records.createRecord); // AN-18
router.put("/:id", requireRole("VETERINARIAN"), records.updateRecord); // AN-20
router.patch("/:id/annul", requireRole("VETERINARIAN"), records.annulRecord); // AN-19

// Adjuntos (examenes, radiografias). Los archivos son privados: solo se
// descargan con sesion y permiso sobre la mascota.
router.post("/:id/attachments", requireRole("VETERINARIAN"), records.addAttachment);
router.get("/attachments/:attachmentId", requireRole("CLIENT", "VETERINARIAN"), records.downloadAttachment);
router.delete("/attachments/:attachmentId", requireRole("VETERINARIAN"), records.removeAttachment);

export default router;
