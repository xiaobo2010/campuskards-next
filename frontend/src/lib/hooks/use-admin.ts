import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { User, PaginatedResponse, AdminUser } from "@/types";

export function useAdminUsers(page = 1) {
  return useQuery<PaginatedResponse<AdminUser>>({
    queryKey: ["admin-users", page],
    queryFn: () =>
      apiFetch<PaginatedResponse<AdminUser>>(
        `/api/admin/users?page=${page}`
      ),
    staleTime: 30 * 1000,
  });
}

export function useAdminCards(page = 1) {
  return useQuery<PaginatedResponse<unknown>>({
    queryKey: ["admin-cards", page],
    queryFn: () =>
      apiFetch<PaginatedResponse<unknown>>(
        `/api/admin/cards?page=${page}`
      ),
    staleTime: 30 * 1000,
  });
}

export function useUpdateUserEconomy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      ...data
    }: {
      userId: string;
      elo?: number;
      ink?: number;
    }) =>
      apiFetch<AdminUser>(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
