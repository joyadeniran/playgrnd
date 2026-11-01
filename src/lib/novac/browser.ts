import type { ProxyResult } from "./types";

export async function callNovac(
  action: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
): Promise<ProxyResult> {
  let url = `/api/novac/${action}`;
  if (method === "GET" && body) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "boolean") {
        if (value) params.set(key, "1");
      } else if (value != null) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const response = await fetch(url, {
    method,
    headers: method === "POST" ? { "content-type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      mode: "sandbox",
      novac: { method, path: `/${action}`, status: response.status },
      request: body ?? null,
      response: null,
      message: "The bench returned a response that was not JSON.",
    };
  }
  return data as ProxyResult;
}

export function redirectFrom(result: ProxyResult): string | null {
  const response = result.response;
  if (!response || typeof response !== "object") return null;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const target = (data as { paymentRedirectUrl?: unknown }).paymentRedirectUrl;
  return typeof target === "string" && target ? target : null;
}
