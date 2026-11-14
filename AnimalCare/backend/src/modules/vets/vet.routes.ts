import express from "express";

import { listVets, getVet, getSlots, getDays } from "./vet.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import vetPanelRoutes from "./panel/vetPanel.routes";

const router = express.Router();

// Para ver veterinarios hay que haber iniciado sesion.
router.use(authenticate);

// Va antes de "/:id" para que "me" no se lea como un id.
router.use("/me", requireRole("VETERINARIAN"), vetPanelRoutes);

router.get("/", listVets);
router.get("/:id", getVet);
router.get("/:id/slots", getSlots);
router.get("/:id/days", getDays);

export default router;
