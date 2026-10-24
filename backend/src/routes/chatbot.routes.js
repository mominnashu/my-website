import { Router } from "express";
import { z } from "zod";
import { answerPlatformQuestion, getPublicAssistantConfig } from "../services/chatbot.service.js";
import { sendError, sendSuccess } from "../utils/response.js";

const router = Router();
const messageSchema = z.object({
  message: z.string().trim().min(1).max(500),
  language: z.enum(["en", "hi", "te"]).optional(),
});

router.get("/config", (_req, res) => sendSuccess(res, getPublicAssistantConfig()));

router.post("/message", (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "INVALID_CHAT_MESSAGE", "Enter a question up to 500 characters.", 400);
  }
  return sendSuccess(res, answerPlatformQuestion(parsed.data.message, parsed.data.language));
});

export default router;
