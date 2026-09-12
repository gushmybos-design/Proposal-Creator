# HubSpot app assets for Propel

Two ways to put Propel on the Deal record. Start with the classic card (5 minutes, no tooling);
move to the UI extension when you want the richer in-record experience.

## Option A — classic CRM card (no build step)

1. developers.hubspot.com → your app → **CRM cards** → *Create card*
2. Object type: **Deals** · Data fetch URL: `https://<propel-domain>/api/hubspot/crm-card` · Properties sent: `dealname`
3. Save. Propel verifies each request with the v3 signature; the card lists proposals with Edit / Preview
   actions and a *New proposal* primary action (all open Propel in an iframe).

## Option B — React UI extension (this folder)

Built with HubSpot **developer projects** (`hs project …`). It renders `src/app/extensions/ProposalsCard.jsx`
inside the deal record and calls Propel's `/api/hubspot/ext/proposals` endpoint over `hubspot.fetch()`.

```bash
npm i -g @hubspot/cli
hs init                      # authenticate the CLI against your developer account
cd hubspot
# 1) replace every YOUR-PROPEL-DOMAIN in src/app/public-app.json and ProposalsCard.jsx
# 2) if you already created the app in the UI, run `hs project migrate-app` instead of creating a new one
hs project upload            # creates/updates the app + card in your developer account
hs project dev               # (optional) live-reload the card against a test portal
```

Then install the app on your portal (the same OAuth install Propel's landing page runs) — the card
appears in the deal record's **Custom** tab (drag it to the middle column via *Customize record*).

Notes
- `permittedUrls.fetch` must contain your Propel origin or `hubspot.fetch` is blocked.
- Requests carry `X-HubSpot-Signature-v3` signed with the app **client secret**; Propel's
  `verifyHubSpotSignature` checks method + URL + body + timestamp.
- The extension passes the HubSpot user's email so proposals created from the card are owned by that rep.
- Platform version is pinned to `2025.1` in `hsproject.json`; if HubSpot has since deprecated it, run
  `hs project upgrade` — the card code is unaffected, only the JSON manifests move.

## Custom timeline events (optional, both options)

By default Propel writes activity as deal **notes**. For filterable timeline events with their own icon:

```bash
HUBSPOT_APP_ID=<app id> HUBSPOT_DEVELOPER_API_KEY=<developer key> npm run hubspot:timeline
```

Paste the printed ids into Propel → Settings → *Timeline event templates*. Events: published, viewed,
accepted, declined, changes_requested, countersigned. Propel falls back to a note if an event fails.

## Scopes

`oauth crm.objects.deals.read crm.objects.deals.write crm.objects.contacts.read crm.objects.companies.read crm.objects.line_items.read crm.objects.owners.read`

Add `timeline` (Timeline events API) if you use custom timeline events.
