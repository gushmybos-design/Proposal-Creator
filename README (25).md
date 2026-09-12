# Propel — interactive proposals for MYBOS, built into HubSpot

Propel is a Qwilr-style proposal platform: reps create a proposal from a HubSpot deal in one click,
customise it in a block-based editor, send a mobile-optimised web link, and get engagement analytics,
e-signature and HubSpot write-back — without leaving the deal record.

| Qwilr feature seen in the demo | Propel equivalent |
| --- | --- |
| Animated cover, block-based pages, video, accordions | `hero`, `text`, `features`, `image`, `video`, `accordion` blocks (`src/lib/blocks/schema.ts`) |
| Quote block, static pricing (MYBOS preference), optional add-ons | `quote` block with one-off / monthly / yearly items, GST, discount, optional toggles |
| T&Cs + legally-binding e-signature | `accept` block: drawn signature, signer identity, terms version, IP hash, UA stored on `Signature` |
| Templates with variables, saved line items, block library | Templates + `{{deal.dealname}}`-style variables, saved line items in Settings |
| Two-way HubSpot sync | OAuth app, deal/contact/company/owner/line-item pull, deal-stage + note write-back on accept |
| No extra login for reps | HubSpot OAuth *is* the login; CRM card on the Deal record opens Propel in an iframe |
| Engagement analytics (timeline, time per block, idle excluded) | `/proposals/[id]/analytics` fed by `/api/track` beacons |
| Proactive notifications (opened, revisit, accepted, stalled signing) | In-app bell, email (Resend), HubSpot deal notes; hourly cron for stalled/expiring |
| Mobile optimised | Responsive renderer, editor has a phone preview toggle |
| — | **Beyond Qwilr's demo:** decline / request-changes flow with re-open, MYBOS counter-signature & executed-copy email, signed PDF export, image uploads (Vercel Blob), admin/rep roles, audit log, template version history, React UI-extension card + custom timeline events |

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind v4 · Prisma 7 + Postgres · iron-session · Resend (optional) · dnd-kit.

```
src/
  app/
    (app)/               # signed-in area: dashboard, editor, analytics, templates, settings
    p/[token]/           # public client-facing proposal page
    api/hubspot/         # install (OAuth start), callback, crm-card, deals (search)
    api/track/           # engagement beacons
    api/proposals/[token]/accept/   # e-signature submit
    api/proposals/[token]/feedback/ # decline / request changes
    api/proposals/[token]/pdf/      # signed PDF (headless Chromium)
    api/upload/          # image upload (Vercel Blob / local disk)
    api/hubspot/ext/     # backend for the React UI-extension card
    api/cron/stalled/    # hourly job: stalled signing, expiring, mark expired
    (app)/settings/audit # audit log (admins)
    dev-login/           # DEV ONLY: sign in without HubSpot
  components/
    editor/              # Editor (canvas + sortable block list + inspector), NewProposalForm
    renderer/            # ProposalRenderer + block components, AcceptBlock, SignaturePad, useTracker
  lib/
    blocks/              # zod block schema, quote maths, template variables
    hubspot/             # oauth, API client w/ token refresh, deal context, write-back, signature check
    actions/             # server actions (proposals, templates, settings)
    notifications.ts     # notify() + scheduled scans
    session.ts, db.ts, env.ts
    pdf.ts, storage.ts, audit.ts
prisma/schema.prisma     # data model + migrations
hubspot/                 # HubSpot developer project: React UI-extension card, timeline templates script
e2e/smoke.mjs            # Playwright E2E: create → publish → view (mobile) → request changes → re-open → sign → counter-sign → PDF → audit
```

**Deploying?** See [DEPLOY.md](DEPLOY.md) — Vercel + Neon + Blob in ~20 minutes.

## 1. Run locally (no HubSpot needed)

```bash
cp .env.example .env            # set DATABASE_URL, SESSION_SECRET
npm install                     # runs `prisma generate`
npx prisma migrate deploy       # applies prisma/migrations (or `npx prisma db push`)
npm run dev
```

Open http://localhost:3000 → **Dev login (no HubSpot)**. You get a demo workspace with a seeded
"MYBOS standard proposal" template. Create a proposal, publish, open the client link in a private
window, scroll, sign, then look at Analytics. The dev login route returns 404 in production.

## 2. HubSpot app setup

1. Create a developer account at developers.hubspot.com → *Apps* → **Create app** (public app).
2. **Auth** tab
   - Redirect URL: `https://<your-domain>/api/hubspot/callback`
   - Scopes: `oauth crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read crm.objects.companies.read crm.objects.line_items.read crm.objects.owners.read`
   - Copy Client ID / Client secret into `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET`.
3. **CRM cards** → *Create card* → Object type **Deals**
   - Data fetch URL: `https://<your-domain>/api/hubspot/crm-card`
   - Properties to send: `dealname`
   - Card title: *Proposals*
   Requests are verified with HubSpot's v3 signature (`x-hubspot-signature-v3`) using the client secret.
   The card lists every proposal for the deal (status, views, accepted date) with **Edit** / **Preview**
   actions and a **New proposal** primary action that opens `/proposals/new?dealId=…` in an iframe.
4. Install: visit `https://<your-domain>/api/hubspot/install` (or click **Continue with HubSpot** on the
   landing page) and approve. Each HubSpot portal becomes a `Workspace`; each HubSpot user who signs in
   becomes a `User`. Tokens are refreshed automatically (`lib/hubspot/client.ts`).
5. In Propel → **Settings**, pick the deal stage to move to when a proposal is accepted. Build the rest of
   your automation (invoice, onboarding tasks, Slack) as a HubSpot workflow on that stage change.

Local development against HubSpot needs a public HTTPS URL for OAuth and the card — `ngrok http 3000`
and set `APP_URL` to the ngrok URL.

### What syncs

- **Pull (proposal creation)**: deal properties, primary contact, company, deal owner and line items.
  Template variables `{{deal.*}} {{contact.*}} {{company.*}} {{owner.*}} {{today}}` are resolved and
  HubSpot line items replace the template's quote items. The snapshot is stored on `Proposal.variables`.
- **Push**: publish → note on deal with link · first view → note · accepted → deal stage change,
  amount updated to accepted total, note with signer details and link.

## 3. Deploy

Any Node host works. For Vercel: set the env vars from `.env.example` plus `CRON_SECRET`;
`vercel.json` schedules `/api/cron/stalled` hourly (stalled-signing nudges, 3-day expiry warnings,
marks expired proposals). Run `npx prisma migrate deploy` against your production database.
Set `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` to email reps; otherwise notifications are in-app + HubSpot notes only.

## 4. How the pieces work

**Blocks** are a discriminated union validated with zod on every save (`blocksSchema.parse`), so the DB
never holds a malformed page. Adding a block type = add a schema in `schema.ts`, a renderer in
`renderer/blocks.tsx`, a form in `editor/BlockInspector.tsx`.

**Editor** autosaves 1s after the last change via a server action, warns on unload if dirty, supports
drag-reorder, duplicate, delete, live canvas selection, desktop/phone preview, theme (brand colour, logo,
font) and expiry date. Templates use the same editor with variable hints.

**Tracking** (`useTracker`): an IntersectionObserver accumulates dwell seconds per block while ≥50% visible
and the tab is active; batches are posted every 10s and via `sendBeacon` on hide. Accordion opens and video
plays are `CLICK` events; opening the sign form is `ACCEPT_STARTED` (drives the "stalled" notification).
Preview mode (`?preview=1`, or drafts) never records.

**Acceptance** (`/api/proposals/[token]/accept`): validates status/expiry, freezes the client's optional
selections into the proposal, stores the signature image + audit fields, marks `ACCEPTED`, then fires
notifications and HubSpot write-back. Repeat submissions return 409.

**Security**: unguessable 21-char public tokens; drafts visible only to workspace members; HubSpot card
requests signature-verified; sessions are encrypted httpOnly cookies; IPs are stored hashed only.

## 5. Tests

```bash
npm run dev                      # in one terminal
node e2e/smoke.mjs               # in another (needs Playwright + Chromium)
```

The smoke test logs in, creates and edits a proposal, publishes, views it on a phone-sized browser,
signs on desktop, and asserts the analytics page shows the signature. Screenshots land in the scratch folder
configured at the top of the script.

## 6. Feature notes

**Decline / request changes** — from the accept block the client can *Request changes* (status
`CHANGES_REQUESTED`, link stays live) or *Decline* (status `DECLINED`, optional deal-stage change). The rep
sees the message on the analytics page, edits, and clicks *Re-open & notify client*, which emails the
requester the refreshed link.

**Counter-signature** — Settings → *Require MYBOS counter-signature*. After the client signs, the page
shows "awaiting counter-signature"; any team member counter-signs from analytics. Both signatures render on
the page and in the PDF; the client is emailed the executed copy.

**PDF** — `/api/proposals/[token]/pdf`. Public for accepted proposals (client's record), workspace-only
otherwise. Uses Playwright + bundled Chromium locally (`CHROME_PATH` to override) and `@sparticuz/chromium`
on Vercel. Accordions are expanded and interactive controls hidden in print mode.

**Roles** — first user of a workspace is Admin; everyone else joins as Rep. Admins manage templates,
settings, team roles, saved line items, and can delete anyone's proposals. Reps create/edit/send their own.

**Audit log** — Settings → Audit log. Every create/publish/unpublish/delete/reopen/counter-sign/settings/
role change is recorded with actor, entity and a small meta payload (`lib/audit.ts`).

**Template versions** — each template save is snapshotted (grouped in 5-minute windows). *History* in the
template editor lets admins restore any version (the current state is snapshotted first).

**Images** — hero backgrounds, image blocks and logos accept a URL or an upload (PNG/JPG/WEBP/GIF/SVG ≤ 8 MB).

## 7. Still on the list

- Multi-currency + per-region tax presets; line-item level discounts.
- Comments on individual blocks from the client (Qwilr-style inline questions).
- Proposal-level access control (email gate / passcode) for sensitive pricing.
- Slack notifications (HubSpot → Slack works today via workflow on the stage change).
- Bulk analytics across proposals (win rates by template / block engagement heatmap).
