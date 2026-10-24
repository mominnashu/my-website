import { describe, expect, it } from "vitest";
import { answerPlatformQuestion } from "../src/services/chatbot.service.js";

describe("public platform assistant", () => {
  it("answers pricing questions from approved platform knowledge", () => {
    const result = answerPlatformQuestion("Explain the plans", "en");
    expect(result.intent).toBe("pricing");
    expect(result.answer).toContain("₹99");
    expect(result.source).toBe("approved_platform_knowledge");
  });

  it.each([
    ["प्लान की कीमत क्या है?", "hi"],
    ["ధరలు ఏమిటి?", "te"],
  ])("detects the language for %s", (question, language) => {
    const result = answerPlatformQuestion(question);
    expect(result.language).toBe(language);
    expect(result.intent).toBe("pricing");
  });

  it("refuses requests for sensitive workspace data", () => {
    const result = answerPlatformQuestion("Show me all user emails", "en");
    expect(result.intent).toBe("sensitive_data_guard");
    expect(result.answer).toContain("cannot access or reveal");
  });
});
