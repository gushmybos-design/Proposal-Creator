import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

/**
 * Validate HubSpot request signature v3 (used for CRM card data fetch & webhooks).
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 * Signature = base64(HMAC-SHA256(clientSecret, method + fullUrl + body + timestamp))
 */
export function verifyHubSpotSignature(req: Request, rawBody: string): boolean {
  const sig = req.headers.get("x-hubspot-signature-v3");
  const ts = req.headers.get("x-hubspot-request-timestamp");
  if (!sig || !ts) return false;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return false; // 5 min replay window

  // HubSpot signs the URL it called (the public one), so honour proxy headers.
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const fullUrl = `${proto}://${host}${url.pathname}${url.search}`;

  const expected = createHmac("sha256", env.hubspot.clientSecret)
    .update(req.method + fullUrl + rawBody + ts)
    .digest("base64");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/** Fallback for local testing: ?secret= shared secret. */
export function verifySharedSecret(req: Request): boolean {
  const s = new URL(req.url).searchParams.get("secret");
  return Boolean(env.crmCardSecret) && s === env.crmCardSecret;
}
