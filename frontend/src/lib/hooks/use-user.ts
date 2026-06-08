import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { User } from "@/types";

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiFetch<User>("/api/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<unknown>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
  });
}
