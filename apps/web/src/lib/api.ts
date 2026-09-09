import type {
  Category,
  DashboardStats,
  EntryDetail,
  EntryInput,
  EntryUpdate,
  EntryVersion,
  SearchQuery,
  SearchResult,
  SecretScanResponse,
  Tag,
} from "@command-vault/shared";

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(status: number, payload: any) {
    super(payload?.error ?? `Eroare API (${status})`);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

function qs(params: Record<string, any>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      for (const v of value) search.append(key, String(v));
    } else {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const api = {
  auth: {
    setupRequired: () => request<{ setupRequired: boolean }>("/auth/setup-required"),
    me: () => request<{ id: string; email: string; displayName: string }>("/auth/me"),
    register: (email: string, password: string) =>
      request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    logout: () => request("/auth/logout", { method: "POST" }),
  },
  categories: {
    list: () => request<(Category & { entryCount: number })[]>("/categories"),
    create: (data: Partial<Category>) => request<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Category>) =>
      request<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/categories/${id}`, { method: "DELETE" }),
  },
  tags: {
    list: () => request<(Tag & { entryCount: number })[]>("/tags"),
    create: (name: string, color?: string | null) =>
      request<Tag>("/tags", { method: "POST", body: JSON.stringify({ name, color }) }),
    update: (id: string, data: Partial<Tag>) => request<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    merge: (from: string, to: string) => request("/tags/merge", { method: "POST", body: JSON.stringify({ from, to }) }),
    remove: (id: string) => request<void>(`/tags/${id}`, { method: "DELETE" }),
  },
  entries: {
    search: (query: Partial<SearchQuery>) => request<SearchResult>(`/entries${qs(query)}`),
    get: (id: string) => request<EntryDetail>(`/entries/${id}`),
    versions: (id: string) => request<EntryVersion[]>(`/entries/${id}/versions`),
    create: (data: EntryInput) => request<EntryDetail>("/entries", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: EntryUpdate) =>
      request<EntryDetail>(`/entries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/entries/${id}`, { method: "DELETE" }),
    toggleFavorite: (id: string) => request<{ isFavorite: boolean }>(`/entries/${id}/favorite`, { method: "POST" }),
    recordCopy: (id: string) => request<{ ok: true }>(`/entries/${id}/copy`, { method: "POST" }),
    restoreVersion: (id: string, version: number) =>
      request<EntryDetail>(`/entries/${id}/versions/${version}/restore`, { method: "POST" }),
    downloadUrl: (id: string) => `/api/entries/${id}/download`,
    scanSecrets: (body: string) =>
      request<SecretScanResponse>("/entries/secret-scan", { method: "POST", body: JSON.stringify({ body }) }),
  },
  dashboard: {
    get: () => request<DashboardStats>("/dashboard"),
  },
};
