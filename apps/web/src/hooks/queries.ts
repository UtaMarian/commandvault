import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EntryInput, EntryUpdate, SearchQuery } from "@command-vault/shared";
import { api } from "../lib/api";

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: api.categories.list });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: api.tags.list });
}

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard.get });
}

export function useEntrySearch(query: Partial<SearchQuery>) {
  return useQuery({
    queryKey: ["entries", "search", query],
    queryFn: () => api.entries.search(query),
    placeholderData: (prev) => prev,
  });
}

export function useEntry(id: string | undefined) {
  return useQuery({
    queryKey: ["entries", "detail", id],
    queryFn: () => api.entries.get(id!),
    enabled: !!id,
  });
}

export function useEntryVersions(id: string | undefined) {
  return useQuery({
    queryKey: ["entries", "versions", id],
    queryFn: () => api.entries.versions(id!),
    enabled: !!id,
  });
}

function useInvalidateEntries() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["entries"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["tags"] });
  };
}

export function useCreateEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (data: EntryInput) => api.entries.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntryUpdate }) => api.entries.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (id: string) => api.entries.remove(id),
    onSuccess: invalidate,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.entries.toggleFavorite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useRecordCopy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.entries.recordCopy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRestoreVersion() {
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => api.entries.restoreVersion(id, version),
    onSuccess: (_data, vars) => {
      invalidate();
    },
  });
}
