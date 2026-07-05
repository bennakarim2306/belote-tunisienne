// Minimal API client. All calls go through the /api ingress prefix.
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

let authToken: string | null = null;
export const setApiToken = (t: string | null) => {
  authToken = t;
};
export const getApiToken = () => authToken;

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "error";
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      // non-json error body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  put: (path: string, body?: unknown) => request("PUT", path, body),
  del: (path: string) => request("DELETE", path),
};

export const wsUrl = (path: string) =>
  `${BASE_URL.replace(/^http/, "ws")}${path}`;
