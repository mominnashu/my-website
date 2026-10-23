import { caseService } from "../services/case.service.js";
import { auditService } from "../services/auditLog.service.js";
import { sendSuccess } from "../utils/response.js";

export const caseController = {
  async create(req, res, next) {
    try {
      const caseDoc = await caseService.createCase(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "CASE_CREATE",
        resourceType: "Case",
        resourceId: caseDoc._id,
        requestId: res.locals?.requestId,
        details: { title: caseDoc.title, priority: caseDoc.priority },
      });

      return sendSuccess(res, { case: caseDoc }, 201);
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const result = await caseService.listCases(req.query, req.user);
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const caseDoc = await caseService.getCaseById(req.params.id, req.user);
      return sendSuccess(res, { case: caseDoc }, 200);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const caseDoc = await caseService.updateCase(req.params.id, req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "CASE_UPDATE",
        resourceType: "Case",
        resourceId: caseDoc._id,
        requestId: res.locals?.requestId,
        details: { status: req.body.status, priority: req.body.priority },
      });

      return sendSuccess(res, { case: caseDoc }, 200);
    } catch (error) {
      next(error);
    }
  },

  async addNote(req, res, next) {
    try {
      const caseDoc = await caseService.addNote(req.params.id, req.body.note, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "CASE_NOTE_ADD",
        resourceType: "Case",
        resourceId: caseDoc._id,
        requestId: res.locals?.requestId,
      });

      return sendSuccess(res, { case: caseDoc }, 200);
    } catch (error) {
      next(error);
    }
  },

  async attachDetection(req, res, next) {
    try {
      const caseDoc = await caseService.attachDetection(
        req.params.id,
        req.body.detectionId,
        req.user
      );

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "DETECTION_ATTACH_CASE",
        resourceType: "Case",
        resourceId: caseDoc._id,
        requestId: res.locals?.requestId,
        details: { detectionId: req.body.detectionId },
      });

      return sendSuccess(res, { case: caseDoc }, 200);
    } catch (error) {
      next(error);
    }
  },
};
