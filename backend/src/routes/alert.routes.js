import { Router } from "express";
import { alertController } from "../controllers/alert.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { updateAlertSchema } from "../schemas/alert.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", alertController.list);
router.get("/:id", alertController.getById);
router.post("/:id/acknowledge", alertController.acknowledge);
router.patch("/:id", validateBody(updateAlertSchema), alertController.update);

export default router;
