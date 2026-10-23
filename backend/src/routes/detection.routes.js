import { Router } from "express";
import { detectionController } from "../controllers/detection.controller.js";
import { authenticate } from "../middleware/auth.js";
import { enforceUsageLimit } from "../middleware/usageLimit.js";
import { validateBody } from "../middleware/validate.js";
import {
  socialProfileDetectionSchema,
  brandPageDetectionSchema,
  scamTextDetectionSchema,
  mobileAppDetectionSchema,
  urlDetectionSchema,
} from "../schemas/detection.schema.js";

const router = Router();

router.use(authenticate);
router.use((req, res, next) => req.method === 'POST' ? enforceUsageLimit(req, res, next) : next());

router.get("/", detectionController.list);
router.get("/:id", detectionController.getById);

// Module 1: Fake Social Profile
router.post(
  "/social-profile",
  validateBody(socialProfileDetectionSchema),
  detectionController.detectSocialProfile
);

// Module 2: Fake Brand Page
router.post(
  "/brand-page",
  validateBody(brandPageDetectionSchema),
  detectionController.detectBrandPage
);

// Module 3: Scam Account & Message
router.post(
  "/scam-text",
  validateBody(scamTextDetectionSchema),
  detectionController.detectScamText
);

// Module 4: Fake Mobile Application
router.post(
  "/mobile-app",
  validateBody(mobileAppDetectionSchema),
  detectionController.detectMobileApp
);

// Module 5: Suspicious Phishing URL
router.post(
  "/url",
  validateBody(urlDetectionSchema),
  detectionController.detectUrl
);

import { uploadSingleImage } from "../middleware/upload.js";

// Module 6: Universal Backend Multer OCR Processing, Autofill, and Prediction
router.post(
  "/ocr-process",
  uploadSingleImage,
  detectionController.processOcrAndDetect
);

export default router;
