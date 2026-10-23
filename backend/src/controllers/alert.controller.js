import { alertService } from "../services/alert.service.js";
import { auditService } from "../services/auditLog.service.js";
import { sendSuccess } from "../utils/response.js";

export const alertController = {
  async list(req, res, next) {
    try {
      const result = await alertService.listAlerts(req.query, req.user);
      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const alert = await alertService.getAlertById(req.params.id, req.user);
      return sendSuccess(res, { alert }, 200);
    } catch (error) {
      next(error);
    }
  },

  async acknowledge(req, res, next) {
    try {
      const alert = await alertService.acknowledgeAlert(req.params.id, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "ALERT_ACKNOWLEDGE",
        resourceType: "Alert",
        resourceId: alert._id,
        requestId: res.locals?.requestId,
        details: { title: alert.title },
      });

      return sendSuccess(res, { alert }, 200);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const alert = await alertService.updateAlert(req.params.id, req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "ALERT_STATUS_UPDATE",
        resourceType: "Alert",
        resourceId: alert._id,
        requestId: res.locals?.requestId,
        details: { status: req.body.status, severity: req.body.severity },
      });

      return sendSuccess(res, { alert }, 200);
    } catch (error) {
      next(error);
    }
  },
};
