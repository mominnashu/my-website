import { z } from "zod";
import { ALERT_STATUSES, ALERT_SEVERITIES } from "../types/constants.js";

export const updateAlertSchema = z.object({
  status: z.enum(ALERT_STATUSES).optional(),
  severity: z.enum(ALERT_SEVERITIES).optional(),
  assignedUser: z.string().optional(),
  resolutionNotes: z.string().optional(),
});
