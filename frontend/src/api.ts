const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function apiAssetUrl(path: string) {
  return `${API_BASE}${path}`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const isFormDataBody = init?.body instanceof FormData;

  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
    ...init
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? ((payload as { error: string }).error)
        : `Request failed: ${response.status}`;

    throw new ApiError(errorMessage, response.status, payload);
  }

  return payload as T;
}
