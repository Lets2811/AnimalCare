import express from "express";

import { createAppointment,
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
  startAppointment,
  completeAppointment,
  payAppointment,
  reviewAppointment, } from "./appointment.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const router = express.Router();

router.use(authenticate);

// Agendar es una accion del cliente: un veterinario no se agenda a si mismo.
router.post("/", requireRole("CLIENT"), createAppointment);

// El listado sirve a los dos roles: el controlador decide que citas devolver.
router.get("/", listMyAppointments);

// AN-14 (cliente) y AN-15 (veterinario). El controlador comprueba que la cita sea suya.
router.patch("/:id/cancel", requireRole("CLIENT", "VETERINARIAN"), cancelAppointment);

// AN-16: gestion de la agenda por el veterinario.
router.patch("/:id/reschedule", requireRole("VETERINARIAN"), rescheduleAppointment);
router.patch("/:id/confirm", requireRole("VETERINARIAN"), confirmAppointment);
router.patch("/:id/start", requireRole("VETERINARIAN"), startAppointment);
router.patch("/:id/complete", requireRole("VETERINARIAN"), completeAppointment);

// Resena del cliente despues de una cita atendida.
router.post("/:id/pay", requireRole("CLIENT"), payAppointment); // pago simulado
router.post("/:id/review", requireRole("CLIENT"), reviewAppointment);

export default router;
