/**
 * Canonical ApiError class + handleApiError utility.
 * All API error handling should use this module.
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Normalize any thrown value into an ApiError.
 * - If already an ApiError, return as-is.
 * - If a network/fetch TypeError, mark status 0.
 * - Otherwise wrap as unknown error.
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) {
    // Network error (fetch failed, no response)
    return new ApiError(0, error.message || "网络连接失败，请检查网络", error);
  }
  if (error instanceof Error) {
    return new ApiError(0, error.message, error);
  }
  return new ApiError(0, "未知错误", error);
}
