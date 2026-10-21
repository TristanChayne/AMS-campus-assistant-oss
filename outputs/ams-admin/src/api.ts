export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
  options: { notifyUnauthorized?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(`/api/admin/${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal,
    });
    if (!(r.headers.get("content-type") || "").includes("application/json"))
      throw new ApiError(503, "管理服务尚未接入，请稍后重试。");
    const data = await r.json();
    if (r.status === 401 && options.notifyUnauthorized !== false)
      window.dispatchEvent(new Event("ams-admin-expired"));
    if (!r.ok)
      throw new ApiError(
        r.status,
        data.error?.message || data.message || "请求未完成，请重试。",
      );
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      0,
      e instanceof Error && e.name === "AbortError"
        ? "连接超时，请重试。"
        : "无法连接管理服务，请检查网络后重试。",
    );
  } finally {
    clearTimeout(timer);
  }
}

// Search and local pagination must cover every installation, including pages
// beyond the backend's default limit. Only device metadata is fetched here.
export async function allItems<T>(path: string): Promise<{ items: T[] }> {
  const items: T[] = [],
    seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const result: { items: T[]; nextCursor?: string | null } = await api(
      cursor === null ? path : `${path}?cursor=${encodeURIComponent(cursor)}`,
    );
    items.push(...result.items);
    cursor = result.nextCursor ?? null;
    if (cursor !== null) {
      if (seen.has(cursor))
        throw new ApiError(503, "列表分页异常，请刷新重试。");
      seen.add(cursor);
    }
  } while (cursor !== null);
  return { items };
}
