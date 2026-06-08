"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { ApiError, handleApiError } from "@/lib/api-error";

interface UseApiActionOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

/**
 * Generic hook that wraps an async API action with loading/error state.
 * - On success: calls onSuccess callback.
 * - On failure: calls onError callback + shows toast.error.
 * - Returns execute function, loading boolean, and error state.
 */
export function useApiAction<T, A extends unknown[]>(
  action: (...args: A) => Promise<T>,
  options?: UseApiActionOptions<T>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Keep latest callbacks in refs to avoid stale closures
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(
    async (...args: A): Promise<T | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const data = await action(...args);
        optionsRef.current?.onSuccess?.(data);
        return data;
      } catch (err) {
        const apiError = handleApiError(err);
        setError(apiError);
        toast.error(apiError.message);
        optionsRef.current?.onError?.(apiError);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    // action identity is caller's responsibility; we use ref for options
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action],
  );

  return { execute, loading, error };
}
