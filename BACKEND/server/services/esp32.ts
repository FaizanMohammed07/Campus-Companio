type PostResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

type PostOptions = {
  target?: string;
  timeoutMs?: number;
};

const DEFAULT_ESP32_URL = "http://192.168.4.1/cmd";

export async function postEsp32(
  payload: unknown,
  options?: PostOptions,
): Promise<PostResult> {
  const target = options?.target || process.env.ESP32_URL || DEFAULT_ESP32_URL;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 1200,
  );

  try {
    const resp = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return {
        ok: false,
        status: resp.status,
        error: `ESP32 responded ${resp.status}`,
      };
    }
    return { ok: true, status: resp.status };
  } catch (err: any) {
    clearTimeout(timeout);
    return { ok: false, error: err?.message || "esp32_request_failed" };
  }
}
