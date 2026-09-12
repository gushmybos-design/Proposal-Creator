/** Centralised, lazily-read environment config. Missing values throw with a helpful message. */
function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return v;
}

export const env = {
  get appUrl() {
    return req("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret() {
    return req("SESSION_SECRET");
  },
  get crmCardSecret() {
    return process.env.CRM_CARD_SECRET ?? "";
  },
  hubspot: {
    get clientId() {
      return req("HUBSPOT_CLIENT_ID");
    },
    get clientSecret() {
      return req("HUBSPOT_CLIENT_SECRET");
    },
    get scopes() {
      return (
        process.env.HUBSPOT_SCOPES ??
        "oauth crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read crm.objects.companies.read crm.objects.line_items.read crm.objects.owners.read"
      );
    },
    get redirectUri() {
      return `${env.appUrl}/api/hubspot/callback`;
    },
    get configured() {
      return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
    },
  },
  email: {
    get resendKey() {
      return process.env.RESEND_API_KEY ?? "";
    },
    get from() {
      return process.env.NOTIFY_FROM_EMAIL ?? "Propel <no-reply@example.com>";
    },
  },
  get isDev() {
    return process.env.NODE_ENV !== "production";
  },
};
