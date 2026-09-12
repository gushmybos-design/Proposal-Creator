import { prisma } from "@/lib/db";
import { refreshAccessToken } from "./oauth";

const HS = "https://api.hubapi.com";

/**
 * Authenticated HubSpot API client for a workspace. Handles token refresh
 * transparently (refreshes ~2 minutes before expiry).
 */
export class HubSpotClient {
  constructor(private workspaceId: string) {}

  private async accessToken(): Promise<string> {
    const conn = await prisma.hubSpotConnection.findUnique({ where: { workspaceId: this.workspaceId } });
    if (!conn) throw new HubSpotNotConnected();
    if (conn.expiresAt.getTime() - Date.now() > 2 * 60_000) return conn.accessToken;

    const t = await refreshAccessToken(conn.refreshToken);
    const updated = await prisma.hubSpotConnection.update({
      where: { workspaceId: this.workspaceId },
      data: {
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        expiresAt: new Date(Date.now() + t.expires_in * 1000),
      },
    });
    return updated.accessToken;
  }

  async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(`${HS}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!res.ok) throw new HubSpotApiError(res.status, path, text);
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  get<T = unknown>(path: string) {
    return this.request<T>(path);
  }
  post<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }
  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }
}

export class HubSpotNotConnected extends Error {
  constructor() {
    super("HubSpot is not connected for this workspace.");
  }
}
export class HubSpotApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: string,
  ) {
    super(`HubSpot API ${status} on ${path}: ${body.slice(0, 300)}`);
  }
}

export type HsObject = {
  id: string;
  properties: Record<string, string | null>;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
};
