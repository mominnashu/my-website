import { Router } from "express";
import { brandController } from "../controllers/brand.controller.js";
import { authenticate, optionalAuthenticate, requireRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createBrandSchema, updateBrandSchema } from "../schemas/brand.schema.js";

const router = Router();

router.get("/", authenticate, brandController.list);
router.get("/:id", authenticate, brandController.getById);

router.post(
  "/",
  authenticate,
  requireRoles("admin", "analyst"),
  validateBody(createBrandSchema),
  brandController.create
);
router.put(
  "/:id",
  authenticate,
  requireRoles("admin", "analyst"),
  validateBody(updateBrandSchema),
  brandController.update
);
router.delete("/:id", authenticate, requireRoles("admin"), brandController.delete);

export default router;
