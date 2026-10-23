import { brandService } from "../services/brand.service.js";
import { auditService } from "../services/auditLog.service.js";
import { sendSuccess } from "../utils/response.js";

export const brandController = {
  async create(req, res, next) {
    try {
      const brand = await brandService.createBrand(req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "BRAND_CREATE",
        resourceType: "Brand",
        resourceId: brand._id,
        requestId: res.locals?.requestId,
        details: { name: brand.name },
      });

      return sendSuccess(res, { brand }, 201);
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const brands = await brandService.listBrands(req.query, req.user);
      return sendSuccess(res, { brands }, 200);
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const brand = await brandService.getBrandById(req.params.id, req.user);
      return sendSuccess(res, { brand }, 200);
    } catch (error) {
      next(error);
    }
  },

  async update(req, res, next) {
    try {
      const brand = await brandService.updateBrand(req.params.id, req.body, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "BRAND_UPDATE",
        resourceType: "Brand",
        resourceId: brand._id,
        requestId: res.locals?.requestId,
        details: { updatedFields: Object.keys(req.body) },
      });

      return sendSuccess(res, { brand }, 200);
    } catch (error) {
      next(error);
    }
  },

  async delete(req, res, next) {
    try {
      const result = await brandService.deleteBrand(req.params.id, req.user);

      await auditService.log({
        organizationId: req.user.organizationId,
        actorId: req.user.id,
        action: "BRAND_DELETE",
        resourceType: "Brand",
        resourceId: req.params.id,
        requestId: res.locals?.requestId,
      });

      return sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  },
};
