import mongoose from "mongoose";
import { Brand } from "../models/Brand.js";
import { memoryStore } from "../utils/memoryStore.js";
import { v4 as uuidv4 } from "uuid";

export const brandService = {
  async createBrand(data, user) {
    if (mongoose.connection.readyState !== 1) {
      const brand = {
        _id: "brand-" + uuidv4().slice(0, 8),
        organizationId: user.organizationId,
        createdBy: user.id,
        status: "active",
        createdAt: new Date(),
        ...data,
      };
      memoryStore.brands.push(brand);
      return brand;
    }

    return Brand.create({
      ...data,
      organizationId: user.organizationId,
      createdBy: user.id,
      status: "active",
    });
  },

  async listBrands(query, user) {
    if (mongoose.connection.readyState !== 1) {
      return memoryStore.brands.filter((b) => b.status !== "archived");
    }

    const filter = {
      organizationId: user.organizationId,
    };
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = "active";
    }

    if (query.search) {
      filter.name = { $regex: query.search, $options: "i" };
    }

    return Brand.find(filter).sort({ name: 1 });
  },

  async getBrandById(brandId, user) {
    if (mongoose.connection.readyState !== 1) {
      const brand = memoryStore.brands.find((b) => b._id === brandId);
      if (!brand) {
        const error = new Error("Brand not found");
        error.statusCode = 404;
        throw error;
      }
      return brand;
    }

    const brand = await Brand.findOne({
      _id: brandId,
      organizationId: user.organizationId,
    });
    if (!brand) {
      const error = new Error("Brand not found");
      error.statusCode = 404;
      error.code = "BRAND_NOT_FOUND";
      throw error;
    }
    return brand;
  },

  async updateBrand(brandId, data, user) {
    if (mongoose.connection.readyState !== 1) {
      const idx = memoryStore.brands.findIndex((b) => b._id === brandId);
      if (idx === -1) {
        const error = new Error("Brand not found");
        error.statusCode = 404;
        throw error;
      }
      memoryStore.brands[idx] = { ...memoryStore.brands[idx], ...data };
      return memoryStore.brands[idx];
    }

    const brand = await Brand.findOneAndUpdate(
      { _id: brandId, organizationId: user.organizationId },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!brand) {
      const error = new Error("Brand not found");
      error.statusCode = 404;
      error.code = "BRAND_NOT_FOUND";
      throw error;
    }
    return brand;
  },

  async deleteBrand(brandId, user) {
    if (mongoose.connection.readyState !== 1) {
      const brand = memoryStore.brands.find((b) => b._id === brandId);
      if (!brand) {
        const error = new Error("Brand not found");
        error.statusCode = 404;
        throw error;
      }
      brand.status = "archived";
      return { success: true, message: "Brand archived successfully" };
    }

    const brand = await Brand.findOneAndUpdate(
      { _id: brandId, organizationId: user.organizationId },
      { $set: { status: "archived" } },
      { new: true }
    );
    if (!brand) {
      const error = new Error("Brand not found");
      error.statusCode = 404;
      error.code = "BRAND_NOT_FOUND";
      throw error;
    }
    return { success: true, message: "Brand archived successfully" };
  },
};
