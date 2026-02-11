export type UiContext = {
  current_page: string;
  available_actions: string[];
  conversation_history?: { role: string; content: string }[];
};

export type VoiceApiResponse = {
  intent: "NAVIGATE" | "GUIDE" | "BACK" | "HELP" | "STOP" | "FACULTY_TASK";
  target: "A_BLOCK" | "B_BLOCK" | "ADMISSION" | "FEE" | "NONE";
  ui_action: "OPEN_PAGE" | "START_GUIDANCE" | "SHOW_INFO" | "GO_BACK";
  response_text: string;
};

export async function sendVoiceCommand(
  transcript: string,
  uiContext: UiContext,
): Promise<VoiceApiResponse> {
  const res = await fetch("/api/voice-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ transcript, uiContext }),
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(`Voice API ${res.status}: ${message}`);
  }
  const payload = await res.json();
  return unwrapApiResponse<VoiceApiResponse>(payload);
}

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (data?.error?.message) return data.error.message;
      return data?.message || JSON.stringify(data);
    } catch {
      // fall through
    }
  }
  const text = await res.text();
  return text || res.statusText;
}

function unwrapApiResponse<T>(payload: any): T {
  if (payload?.ok === true && payload?.data !== undefined) {
    return payload.data as T;
  }
  if (payload?.ok === false && payload?.error?.message) {
    throw new Error(payload.error.message);
  }
  return payload as T;
}
