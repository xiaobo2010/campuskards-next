import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Announcement, AnnouncementCreateIn, AnnouncementUpdateIn, PaginatedResponse } from "@/types";

export function useAnnouncements(page = 1) {
  return useQuery<PaginatedResponse<Announcement>>({
    queryKey: ["announcements", page],
    queryFn: () =>
      apiFetch<PaginatedResponse<Announcement>>(
        `/api/admin/announcements?page=${page}`
      ),
    staleTime: 60 * 1000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AnnouncementCreateIn) =>
      apiFetch<Announcement>("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & AnnouncementUpdateIn) =>
      apiFetch<Announcement>(`/api/admin/announcements/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/admin/announcements/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}
