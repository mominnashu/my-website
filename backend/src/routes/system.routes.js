import { Router } from "express";
import { systemController } from "../controllers/system.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public health check
router.get("/health", systemController.health);

// System status & metrics with optional auth
router.get("/models", authenticate, systemController.modelStatus);
router.get("/stats", authenticate, systemController.dashboardStats);

export default router;
