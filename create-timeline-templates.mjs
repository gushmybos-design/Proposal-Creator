#!/usr/bin/env node
/**
 * Creates Propel's custom timeline event templates on your HubSpot app.
 *
 * Usage:
 *   HUBSPOT_APP_ID=123456 HUBSPOT_DEVELOPER_API_KEY=eu1-xxxx node hubspot/scripts/create-timeline-templates.mjs
 *
 * Find both in developers.hubspot.com → your app → Auth (App ID) and account → Keys (developer API key).
 * Prints the template ids to paste into Propel → Settings → Timeline event templates.
 */
const appId = process.env.HUBSPOT_APP_ID;
const key = process.env.HUBSPOT_DEVELOPER_API_KEY;
if (!appId || !key) {
  console.error("Set HUBSPOT_APP_ID and HUBSPOT_DEVELOPER_API_KEY");
  process.exit(1);
}

const common = [
  { name: "proposalTitle", label: "Proposal", type: "string" },
  { name: "proposalUrl", label: "Propel link", type: "string" },
];
const person = [
  { name: "signerName", label: "Name", type: "string" },
  { name: "signerEmail", label: "Email", type: "string" },
];

const templates = {
  published: {
    name: "Propel — proposal sent",
    headerTemplate: "📨 Proposal sent: **{{proposalTitle}}**",
    detailTemplate: "Sent by {{repEmail}}. [Open in Propel]({{proposalUrl}})",
    tokens: [...common, { name: "repEmail", label: "Rep", type: "string" }],
  },
  viewed: {
    name: "Propel — proposal opened",
    headerTemplate: "👀 Proposal opened: **{{proposalTitle}}**",
    detailTemplate: "First opened on {{device}}. [Engagement analytics]({{proposalUrl}})",
    tokens: [...common, { name: "device", label: "Device", type: "string" }],
  },
  accepted: {
    name: "Propel — proposal accepted",
    headerTemplate: "✅ Proposal accepted: **{{proposalTitle}}**",
    detailTemplate: "Signed by {{signerName}} ({{signerEmail}}) — total {{acceptedTotal}}. [Signed proposal]({{proposalUrl}})",
    tokens: [...common, ...person, { name: "acceptedTotal", label: "Accepted total", type: "number" }],
  },
  declined: {
    name: "Propel — proposal declined",
    headerTemplate: "❌ Proposal declined: **{{proposalTitle}}**",
    detailTemplate: "{{signerName}} ({{signerEmail}}): {{message}}. [Open in Propel]({{proposalUrl}})",
    tokens: [...common, ...person, { name: "message", label: "Message", type: "string" }],
  },
  changes_requested: {
    name: "Propel — changes requested",
    headerTemplate: "✏️ Changes requested: **{{proposalTitle}}**",
    detailTemplate: "{{signerName}} ({{signerEmail}}): {{message}}. [Open in Propel]({{proposalUrl}})",
    tokens: [...common, ...person, { name: "message", label: "Message", type: "string" }],
  },
  countersigned: {
    name: "Propel — counter-signed",
    headerTemplate: "✍️ Counter-signed: **{{proposalTitle}}**",
    detailTemplate: "Counter-signed by {{signerName}} ({{signerEmail}}). [Executed copy]({{proposalUrl}})",
    tokens: [...common, ...person],
  },
};

const out = {};
for (const [event, t] of Object.entries(templates)) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/timeline/${appId}/event-templates?hapikey=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: t.name, objectType: "deals", headerTemplate: t.headerTemplate, detailTemplate: t.detailTemplate, tokens: t.tokens }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`✖ ${event}:`, json.message ?? JSON.stringify(json));
    continue;
  }
  out[event] = json.id;
  console.log(`✔ ${event}: ${json.id}`);
}
console.log("\nPaste into Propel → Settings → Timeline event templates:");
console.log(JSON.stringify(out, null, 2));
