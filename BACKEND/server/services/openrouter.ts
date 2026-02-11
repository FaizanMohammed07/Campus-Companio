import { z } from "zod";
import { createError } from "../utils/http";

const LlmInputSchema = z.object({
  user_input: z.string(),
  current_page: z.string(),
  available_actions: z.array(z.string()),
  conversation_history: z.array(
    z.object({ role: z.string(), content: z.string() }),
  ),
});

const SYSTEM_PROMPT = `You are the brain of a Campus Companion robot UI.
Respond with a single JSON object and nothing else.

Pages: Home, Visitor Help, Faculty Access, Not Found.

Allowed values:
- intent: NAVIGATE | GUIDE | BACK | HELP | STOP | FACULTY_TASK
- ui_action: OPEN_PAGE | START_GUIDANCE | SHOW_INFO | GO_BACK
- target: A_BLOCK | B_BLOCK | ADMISSION | FEE | NONE

Rules:
- For page navigation (e.g., go to Visitor Help), use intent=NAVIGATE, ui_action=OPEN_PAGE, target=NONE.
- For campus locations (e.g., admissions, fee, A/B block), use intent=GUIDE, ui_action=START_GUIDANCE, target one of A_BLOCK | B_BLOCK | ADMISSION | FEE.
- For going back, use intent=BACK, ui_action=GO_BACK, target=NONE.
- For general help/info, use intent=HELP, ui_action=SHOW_INFO, target=NONE.
- For emergency stop, use intent=STOP, ui_action=GO_BACK, target=NONE.
- Never invent actions or targets. Only use the allowed values above.

Output JSON fields exactly: intent, target, ui_action, response_text.
No markdown. No commentary. JSON only.`;

export async function callOpenRouter(input: unknown): Promise<string> {
  const parsed = LlmInputSchema.safeParse(input);
  if (!parsed.success) {
    throw createError(
      400,
      "INVALID_LLM_INPUT",
      "Invalid LLM input payload",
      parsed.error.issues,
    );
  }
  const { user_input, current_page, available_actions, conversation_history } =
    parsed.data;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw createError(
      500,
      "OPENROUTER_NOT_CONFIGURED",
      "OpenRouter API key missing",
    );
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          user_input,
          current_page,
          available_actions,
          conversation_history,
        }),
      },
    ],
    // Prefer JSON-only responses; some models honor this parameter
    response_format: { type: "json_object" },
  };

  const maxAttempts = 3;
  const retryStatuses = new Set([429, 500, 502, 503, 504]);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Optional headers for OpenRouter analytics / rate-limits friendliness
          "HTTP-Referer": process.env.OPENROUTER_REFERER || "",
          "X-Title": process.env.OPENROUTER_TITLE || "Campus Companion",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        if (retryStatuses.has(res.status) && attempt < maxAttempts) {
          await sleep(300 * attempt * attempt);
          continue;
        }
        throw createError(
          502,
          "OPENROUTER_ERROR",
          `OpenRouter error ${res.status}`,
          { status: res.status, body: text },
        );
      }

      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      return content;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      if (err?.code === "OPENROUTER_ERROR") {
        throw err;
      }
      if (attempt < maxAttempts) {
        await sleep(300 * attempt * attempt);
        continue;
      }
      const message = err?.message || "OpenRouter request failed";
      throw createError(504, "OPENROUTER_TIMEOUT", message);
    }
  }

  throw lastError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
