/**
 * visionServer.ts — HTTP client for the Python Vision Server.
 *
 * The Python server is the SINGLE AUTHORITY for movement commands.
 * This module provides typed helpers for the backend to:
 *   - Set a navigation destination  (POST /set-destination)
 *   - Stop the robot               (POST /stop)
 *   - Get live status               (GET  /status)
 *
 * The backend NEVER sends motor commands directly.
 */

import { logInfo, logError, logWarn } from "../utils/logger";

const DEFAULT_VISION_URL =
  process.env.VISION_SERVER_URL || "http://127.0.0.1:8000";

type VisionResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function visionFetch<T = unknown>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<VisionResult<T>> {
  const url = `${DEFAULT_VISION_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const resp = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text();
      logWarn("vision_server_error", {
        path,
        status: resp.status,
        body: text.slice(0, 200),
      });
      return { ok: false, error: `Vision server ${resp.status}: ${text}` };
    }

    const data = (await resp.json()) as T;
    return { ok: true, data };
  } catch (err: any) {
    clearTimeout(timeout);
    logError("vision_server_unreachable", {
      path,
      error: err?.message || "unknown",
    });
    return { ok: false, error: err?.message || "vision_server_unreachable" };
  }
}

// ── Public API ──

export type VisionStatus = {
  ok: boolean;
  pipeline_healthy: boolean;
  running: boolean;
  frame_age_s: number;
  inference_failures: number;
  person_detected: boolean;
  person_ratio: number;
  person_zone: string;
  confidence: number;
  intent: string;
  nav_state: string;
  destination: string | null;
  nav_obstacles: number;
  nav_paths: number;
};

export async function setVisionDestination(
  destination: string,
): Promise<VisionResult> {
  logInfo("vision_set_destination", { destination });
  return visionFetch("/set-destination", "POST", { destination });
}

export async function stopVisionServer(): Promise<VisionResult> {
  logInfo("vision_stop");
  return visionFetch("/stop", "POST");
}

export async function getVisionStatus(): Promise<VisionResult<VisionStatus>> {
  return visionFetch<VisionStatus>("/status");
}

export async function getVisionDetailedStatus(): Promise<VisionResult<any>> {
  return visionFetch<any>("/detailed-status");
}

export async function getVisionHealth(): Promise<
  VisionResult<{ status: string }>
> {
  return visionFetch<{ status: string }>("/health");
}

export async function getVisionSnapshot(): Promise<
  VisionResult<{ ok: boolean; image_b64: string }>
> {
  return visionFetch<{ ok: boolean; image_b64: string }>("/snapshot");
}

export async function setVisionMode(
  mode: "IDLE" | "NAVIGATION" | "FOLLOW" | "HOST",
): Promise<VisionResult> {
  logInfo("vision_set_mode", { mode });
  return visionFetch("/set-mode", "POST", { mode });
}
