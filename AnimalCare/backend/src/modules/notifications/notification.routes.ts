import express from "express";

import { listMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead, } from "./notification.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = express.Router();

router.use(authenticate);

router.get("/", listMyNotifications);
// Va antes de "/:id/read" para que "read-all" no se lea como un id.
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);

export default router;
