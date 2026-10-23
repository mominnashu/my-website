import { authService } from "../services/auth.service.js";
import { auditService } from "../services/auditLog.service.js";
import { sendSuccess } from "../utils/response.js";

export const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);

      await auditService.log({
        organizationId: result.user.organizationId,
        actorId: result.user.id,
        action: "USER_REGISTER",
        resourceType: "User",
        resourceId: result.user.id,
        requestId: res.locals?.requestId,
        details: { email: result.user.email, role: result.user.role },
      });

      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);

      await auditService.log({
        organizationId: result.user.organizationId,
        actorId: result.user.id,
        action: "USER_LOGIN",
        resourceType: "User",
        resourceId: result.user.id,
        requestId: res.locals?.requestId,
        details: { email: result.user.email },
      });

      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.getCurrentUser(req.user.id);
      return sendSuccess(res, { user }, 200);
    } catch (error) {
      next(error);
    }
  },
};
