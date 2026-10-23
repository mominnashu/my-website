import { z } from "zod";
import { CASE_STATUSES, ALERT_SEVERITIES } from "../types/constants.js";

export const createCaseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").trim(),
  description: z.string().optional().default(""),
  priority: z.enum(ALERT_SEVERITIES).optional().default("medium"),
  assignedAnalyst: z.string().optional(),
  relatedDetections: z.array(z.string()).optional().default([]),
  relatedAlerts: z.array(z.string()).optional().default([]),
});

export const updateCaseSchema = z.object({
  title: z.string().min(3).trim().optional(),
  description: z.string().optional(),
  status: z.enum(CASE_STATUSES).optional(),
  priority: z.enum(ALERT_SEVERITIES).optional(),
  assignedAnalyst: z.string().optional(),
  resolution: z.string().optional(),
});

export const addCaseNoteSchema = z.object({
  note: z.string().min(2, "Note must be at least 2 characters").trim(),
});

export const attachDetectionSchema = z.object({
  detectionId: z.string().min(1, "Detection ID is required"),
});
