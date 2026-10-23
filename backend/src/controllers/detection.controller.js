import { detectionService } from "../services/detection.service.js";
import { auditService } from "../services/auditLog.service.js";
import { sendSuccess } from "../utils/response.js";

export const detectionController = {
  async detectSocialProfile(req, res, next) {
    try {
      const detection = await detectionService.detectSocialProfile(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "DETECTION_RUN",
        resourceType: "Detection",
        resourceId: detection._id,
        requestId: res.locals?.requestId,
        details: {
          detectorType: "social_profile",
          username: req.body.username,
          verdict: detection.verdict,
          riskScore: detection.riskScore,
        },
      });

      return sendSuccess(res, { detection }, 201);
    } catch (error) {
      next(error);
    }
  },

  async detectBrandPage(req, res, next) {
    try {
      const detection = await detectionService.detectBrandPage(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "DETECTION_RUN",
        resourceType: "Detection",
        resourceId: detection._id,
        requestId: res.locals?.requestId,
        details: {
          detectorType: "brand_page",
          pageName: req.body.pageName,
          verdict: detection.verdict,
          riskScore: detection.riskScore,
        },
      });

      return sendSuccess(res, { detection }, 201);
    } catch (error) {
      next(error);
    }
  },

  async detectScamText(req, res, next) {
    try {
      const detection = await detectionService.detectScamText(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "DETECTION_RUN",
        resourceType: "Detection",
        resourceId: detection._id,
        requestId: res.locals?.requestId,
        details: {
          detectorType: "scam_text",
          verdict: detection.verdict,
          riskScore: detection.riskScore,
        },
      });

      return sendSuccess(res, { detection }, 201);
    } catch (error) {
      next(error);
    }
  },

  async detectMobileApp(req, res, next) {
    try {
      const detection = await detectionService.detectMobileApp(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "DETECTION_RUN",
        resourceType: "Detection",
        resourceId: detection._id,
        requestId: res.locals?.requestId,
        details: {
          detectorType: "mobile_app",
          appName: req.body.app_name,
          packageName: req.body.package_name,
          verdict: detection.verdict,
          riskScore: detection.riskScore,
        },
      });

      return sendSuccess(res, { detection }, 201);
    } catch (error) {
      next(error);
    }
  },

  async detectUrl(req, res, next) {
    try {
      const detection = await detectionService.detectUrl(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "DETECTION_RUN",
        resourceType: "Detection",
        resourceId: detection._id,
        requestId: res.locals?.requestId,
        details: {
          detectorType: "url",
          url: req.body.url,
          verdict: detection.verdict,
          riskScore: detection.riskScore,
        },
      });

      return sendSuccess(res, { detection }, 201);
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await detectionService.listDetections(req.query, req.user);
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const detection = await detectionService.getDetectionById(req.params.id, req.user);
      if (!detection) {
        const error = new Error("Detection record not found");
        error.statusCode = 404;
        error.code = "DETECTION_NOT_FOUND";
        throw error;
      }
      return sendSuccess(res, { detection }, 200);
    } catch (error) {
      next(error);
    }
  },

  async processOcrAndDetect(req, res, next) {
    try {
      const { processOcrAndDetect } = await import("../services/ocr.service.js");
      // Support multer uploaded file buffer or raw base64 string from json
      const imageSource = req.file ? req.file.buffer : req.body.image;

      const isExtractOnly = req.body.extractOnly === true || req.body.extractOnly === "true" || req.query.extractOnly === "true";
      const result = await processOcrAndDetect({
        detectorType: req.body.detectorType,
        image: imageSource,
        ocrText: req.body.ocrText,
        brandId: req.body.brandId,
        brandName: req.body.brandName,
        user: req.user,
        extractOnly: isExtractOnly,
      });

      if (result.detection) {
        await auditService.log({
          organizationId: req.user.organizationId,
          actorId: req.user.id,
          action: "DETECTION_RUN_OCR",
          resourceType: "Detection",
          resourceId: result.detection._id,
          requestId: res.locals?.requestId,
          details: {
            detectorType: result.detectorType,
            verdict: result.detection.verdict,
            riskScore: result.detection.riskScore,
            source: req.file ? "multer_multipart_file" : "base64_payload",
          },
        });
      }

      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  },
};
