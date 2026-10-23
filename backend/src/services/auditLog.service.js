import { AuditLog } from "../models/AuditLog.js";
import { logger } from "../utils/logger.js";

export const auditService = {
  async log({
    organizationId,
    actorId,
    action,
    resourceType,
    resourceId,
    requestId,
    details = {},
  }) {
    try {
      return await AuditLog.create({
        organizationId,
        actorId,
        action,
        resourceType,
        resourceId: resourceId?.toString(),
        requestId,
        details,
      });
    } catch (err) {
      // Non-blocking error for audit logging
      logger.warn(`Failed to record audit log: ${err.message}`, { action, resourceType });
      return null;
    }
  },
};
