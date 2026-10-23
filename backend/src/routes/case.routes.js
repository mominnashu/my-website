import { Router } from "express";
import { caseController } from "../controllers/case.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  createCaseSchema,
  updateCaseSchema,
  addCaseNoteSchema,
  attachDetectionSchema,
} from "../schemas/case.schema.js";

const router = Router();

router.use(authenticate);

router.get("/", caseController.list);
router.post("/", validateBody(createCaseSchema), caseController.create);
router.get("/:id", caseController.getById);
router.patch("/:id", validateBody(updateCaseSchema), caseController.update);
router.post("/:id/notes", validateBody(addCaseNoteSchema), caseController.addNote);
router.post(
  "/:id/attach-detection",
  validateBody(attachDetectionSchema),
  caseController.attachDetection
);

export default router;
