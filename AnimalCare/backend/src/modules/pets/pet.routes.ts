// Mascotas del dueño: /api/pets
import express from "express";

import * as pets from "./pet.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";

const router = express.Router();

router.use(authenticate, requireRole("CLIENT"));

router.get("/", pets.listMyPets);
router.post("/", pets.createPet);
router.put("/:id", pets.updatePet);
router.delete("/:id", pets.deactivatePet);

export default router;
