import { env } from "@/lib/env";

const HS = "https://api.hubapi.com";

export function installUrl(state: string) {
  const u = new URL("https://app.hubspot.com/oauth/authorize");
  u.searchParams.set("client_id", env.hubspot.clientId);
  u.searchParams.set("redirect_uri", env.hubspot.redirectUri);
  u.searchParams.set("scope", env.hubspot.scopes);
  u.searchParams.set("state", state);
  return u.toString();
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${HS}/oauth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.hubspot.clientId,
      client_secret: env.hubspot.clientSecret,
      redirect_uri: env.hubspot.redirectUri,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot token error ${res.status}: ${await res.text()}`);
  return res.json();
}

export function exchangeCode(code: string) {
  return tokenRequest({ grant_type: "authorization_code", code });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export type TokenInfo = {
  hub_id: number;
  user_id: number;
  user: string; // email
  hub_domain: string;
  scopes: string[];
};

export async function getTokenInfo(accessToken: string): Promise<TokenInfo> {
  const res = await fetch(`${HS}/oauth/v1/access-tokens/${accessToken}`);
  if (!res.ok) throw new Error(`HubSpot token info error ${res.status}`);
  return res.json();
}
