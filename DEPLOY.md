# Deploying Propel to Vercel

About 20 minutes. You need: a GitHub account, a Vercel account, your HubSpot developer account.
Everything below happens in your browser except step 1.

## 1. Push the code to GitHub

```bash
cd propel
git init && git add -A && git commit -m "Propel"
gh repo create mybos/propel --private --source=. --push     # or create the repo on github.com and `git remote add` + `git push`
```

## 2. Create the Vercel project

1. vercel.com → **Add New… → Project** → import `mybos/propel`. Framework is detected as Next.js.
2. **Do not deploy yet** — open *Environment Variables* on the import screen and add the ones in step 3.
   (Build command is taken from `package.json`: `prisma generate && prisma migrate deploy && next build`,
   so the database must exist before the first build.)

## 3. Database and storage (Vercel Marketplace)

1. In the Vercel project → **Storage → Create Database → Neon (Postgres)** → accept defaults.
   Vercel injects `DATABASE_URL` (pooled) into the project automatically. ✅
2. **Storage → Create → Blob** → this injects `BLOB_READ_WRITE_TOKEN`. ✅ (image uploads)

## 4. Environment variables (Project → Settings → Environment Variables)

| Variable | Value |
| --- | --- |
| `APP_URL` | `https://<project>.vercel.app` for now; change to your custom domain later (then redeploy) |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `CRM_CARD_SECRET` | any random string (used by the cron endpoint & local card testing) |
| `CRON_SECRET` | `openssl rand -hex 32` — Vercel Cron sends it as a Bearer token |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | from developers.hubspot.com → your app → Auth (step 6) |
| `HUBSPOT_SCOPES` | copy from `.env.example` |
| `RESEND_API_KEY` / `NOTIFY_FROM_EMAIL` | optional — rep + client emails. Verify your sending domain in Resend first |

`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are already there from step 3.

## 5. Deploy

Click **Deploy**. The build runs `prisma migrate deploy` (creates all tables) then `next build`.
Open `https://<project>.vercel.app` — you should see the Propel sign-in screen.

Vercel Cron is configured in `vercel.json` to hit `/api/cron/stalled` hourly (stalled-signing nudges,
expiry warnings). Cron requires the project to be on a plan that includes it; on Hobby it runs once a day —
fine for this job.

## 6. HubSpot app

1. developers.hubspot.com → **Apps → Create app** (or reuse the one you made for the trial).
2. **Auth** tab → Redirect URL `https://<project>.vercel.app/api/hubspot/callback`; scopes as in `.env.example`.
   Copy Client ID / secret into Vercel env vars (step 4) → **Redeploy** so they take effect.
3. **Deal record card** — pick one (details in `hubspot/README.md`):
   - *Classic CRM card*: **CRM cards → Create** on Deals, data fetch URL `https://<project>.vercel.app/api/hubspot/crm-card`.
   - *React UI extension*: `npm i -g @hubspot/cli && hs init && cd hubspot && hs project upload` after replacing `YOUR-PROPEL-DOMAIN`.
4. Optional timeline events: `HUBSPOT_APP_ID=… HUBSPOT_DEVELOPER_API_KEY=… npm run hubspot:timeline`, paste ids into Settings.
5. Install: open `https://<project>.vercel.app` → **Continue with HubSpot** → approve. You are the first user, so you become the **Admin**.
6. Propel → Settings: brand colour + logo, deal stage on accept / decline, counter-signature on/off.

Start with a **HubSpot sandbox portal** (Settings → Sandboxes in your production portal) — install there
first, run a deal through create → send → sign → stage change, then install on production.

## 7. Custom domain (optional)

Vercel → Domains → add `proposals.mybos.com` → set `APP_URL` to it → update the HubSpot redirect URL and
card URL → redeploy.

## Notes

- **PDF export** uses `@sparticuz/chromium` on Vercel automatically (Node 20+, ~1 GB memory). If a PDF
  times out, raise the function memory in Vercel → Settings → Functions, or set `PDF_RENDER_BASE_URL` to
  your public URL if the deployment is password-protected.
- **Migrations**: add fields to `prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` locally,
  commit the new folder under `prisma/migrations/` — Vercel applies it on the next build.
- **Logs**: Vercel → Deployments → Functions. HubSpot write-back failures are logged as `[hubspot] …` and
  never break the client flow.
