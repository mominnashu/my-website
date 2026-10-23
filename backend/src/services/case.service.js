import mongoose from "mongoose";
import { Case } from "../models/Case.js";
import { memoryStore } from "../utils/memoryStore.js";
import { v4 as uuidv4 } from "uuid";

export const caseService = {
  async createCase(data, user) {
    if (mongoose.connection.readyState !== 1) {
      const caseDoc = {
        _id: "case-" + uuidv4().slice(0, 8),
        organizationId: user.organizationId,
        createdBy: user.id,
        status: "open",
        notes: [],
        createdAt: new Date(),
        ...data,
      };
      memoryStore.cases.push(caseDoc);
      return caseDoc;
    }

    return Case.create({
      ...data,
      organizationId: user.organizationId,
      createdBy: user.id,
      status: "open",
    });
  },

  async listCases(query, user) {
    if (mongoose.connection.readyState !== 1) {
      let filtered = [...memoryStore.cases];
      if (query.status) filtered = filtered.filter((c) => c.status === query.status);
      if (query.priority) filtered = filtered.filter((c) => c.priority === query.priority);
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
    }

    const { page = 1, limit = 20, status, priority } = query;
    const filter = { organizationId: user.organizationId };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [items, total] = await Promise.all([
      Case.find(filter)
        .populate("assignedAnalyst", "name email")
        .populate("relatedDetections", "detectorType verdict riskScore riskBand")
        .populate("relatedAlerts", "title severity status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take),
      Case.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  },

  async getCaseById(caseId, user) {
    if (mongoose.connection.readyState !== 1) {
      const caseDoc = memoryStore.cases.find((c) => c._id === caseId);
      if (!caseDoc) {
        const error = new Error("Case not found");
        error.statusCode = 404;
        throw error;
      }
      return caseDoc;
    }

    const caseDoc = await Case.findOne({
      _id: caseId,
      organizationId: user.organizationId,
    })
      .populate("assignedAnalyst", "name email")
      .populate("relatedDetections")
      .populate("relatedAlerts")
      .populate("notes.author", "name email");

    if (!caseDoc) {
      const error = new Error("Case not found");
      error.statusCode = 404;
      error.code = "CASE_NOT_FOUND";
      throw error;
    }
    return caseDoc;
  },

  async updateCase(caseId, data, user) {
    if (mongoose.connection.readyState !== 1) {
      const caseDoc = memoryStore.cases.find((c) => c._id === caseId);
      if (!caseDoc) {
        const error = new Error("Case not found");
        error.statusCode = 404;
        throw error;
      }
      Object.assign(caseDoc, data);
      return caseDoc;
    }

    const updates = { ...data };
    if (data.status === "closed" || data.status === "resolved") {
      updates.closedAt = new Date();
    }

    const caseDoc = await Case.findOneAndUpdate(
      { _id: caseId, organizationId: user.organizationId },
      { $set: updates },
      { new: true }
    );

    if (!caseDoc) {
      const error = new Error("Case not found");
      error.statusCode = 404;
      error.code = "CASE_NOT_FOUND";
      throw error;
    }
    return caseDoc;
  },

  async addNote(caseId, noteText, user) {
    const newNote = {
      note: noteText,
      author: user.id,
      authorName: user.name || "Analyst",
      createdAt: new Date(),
    };

    if (mongoose.connection.readyState !== 1) {
      const caseDoc = memoryStore.cases.find((c) => c._id === caseId);
      if (!caseDoc) {
        const error = new Error("Case not found");
        error.statusCode = 404;
        throw error;
      }
      if (!caseDoc.notes) caseDoc.notes = [];
      caseDoc.notes.push(newNote);
      return caseDoc;
    }

    const caseDoc = await Case.findOneAndUpdate(
      { _id: caseId, organizationId: user.organizationId },
      { $push: { notes: newNote } },
      { new: true }
    ).populate("notes.author", "name email");

    if (!caseDoc) {
      const error = new Error("Case not found");
      error.statusCode = 404;
      error.code = "CASE_NOT_FOUND";
      throw error;
    }
    return caseDoc;
  },

  async attachDetection(caseId, detectionId, user) {
    if (mongoose.connection.readyState !== 1) {
      const caseDoc = memoryStore.cases.find((c) => c._id === caseId);
      if (!caseDoc) {
        const error = new Error("Case not found");
        error.statusCode = 404;
        throw error;
      }
      if (!caseDoc.relatedDetections) caseDoc.relatedDetections = [];
      if (!caseDoc.relatedDetections.includes(detectionId)) {
        caseDoc.relatedDetections.push(detectionId);
      }
      return caseDoc;
    }

    const caseDoc = await Case.findOneAndUpdate(
      { _id: caseId, organizationId: user.organizationId },
      { $addToSet: { relatedDetections: detectionId } },
      { new: true }
    );
    if (!caseDoc) {
      const error = new Error("Case not found");
      error.statusCode = 404;
      error.code = "CASE_NOT_FOUND";
      throw error;
    }
    return caseDoc;
  },
};
