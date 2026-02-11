import type { NextFunction, Request, Response } from "express";

export type ApiErrorPayload = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId?: string;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
};

export type ErrorWithStatus = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

export function createError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): ErrorWithStatus {
  const err = new Error(message) as ErrorWithStatus;
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function toApiErrorPayload(
  err: unknown,
  isProd: boolean,
): ApiErrorPayload {
  const error = err as ErrorWithStatus | undefined;
  if (error && (error as any).name === "ZodError") {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: error.message || "Validation error",
      details: isProd ? undefined : (error as any).issues,
    };
  }

  const status =
    error?.status && Number.isFinite(error.status) ? error.status : 500;
  const code = error?.code || "INTERNAL_ERROR";
  const message =
    status >= 500 && isProd
      ? "Internal Server Error"
      : error?.message || "Internal Server Error";

  return {
    status,
    code,
    message,
    details: status >= 500 && isProd ? undefined : error?.details,
  };
}

export function sendOk<T>(
  res: Response,
  data: T,
  requestId?: string,
  status = 200,
) {
  const payload: ApiSuccess<T> = { ok: true, data, requestId };
  return res.status(status).json(payload);
}
