import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const shots = process.env.SHOTS_DIR ?? "e2e/shots";
import { mkdirSync } from "fs";
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

// 1. login
await page.goto(`${BASE}/dev-login`);
await page.waitForURL(/dashboard/);
await page.screenshot({ path: `${shots}/01-dashboard.png` });

// 1b. settings: require counter-signature (admin)
await page.goto(`${BASE}/settings`);
const cs = page.locator('input[name="requireCounterSign"]');
if (!(await cs.isChecked())) await cs.check();
await page.click("text=Save settings");
await page.waitForTimeout(1500);

// 2. new proposal
await page.goto(`${BASE}/proposals/new`);
await page.fill('input[placeholder="Defaults to the deal name"]', "Harbour Towers — MYBOS proposal");
await page.click("text=Create proposal →");
await page.waitForURL(/\/proposals\/.*\/edit/, { timeout: 30000 });
const editUrl = page.url();
const proposalId = editUrl.match(/proposals\/([^/]+)\/edit/)[1];
console.log("proposal", proposalId);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${shots}/02-editor.png` });

// 3. edit hero heading via inspector (select hero in list first)
await page.click("aside >> text=Cover");
const heading = page.locator("aside textarea").first();
await heading.fill("A better way to run Harbour Towers");
await page.waitForTimeout(2000); // autosave
await page.screenshot({ path: `${shots}/03-editor-edited.png` });

// mobile toggle
await page.click('button[title="Mobile"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/04-editor-mobile.png` });

// 4. publish
await page.click("text=Publish & get link");
await page.waitForSelector("text=Copy client link", { timeout: 15000 });
await page.screenshot({ path: `${shots}/05-published.png` });

// get public link from dashboard row
await page.goto(`${BASE}/dashboard`);
const link = await page.locator('a[title="Open client link"]').first().getAttribute("href");
console.log("public link", link);

// 5. client view (fresh context, mobile)
const client = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" });
const cp = await client.newPage();
cp.on("pageerror", (e) => console.log("[client pageerror]", e.message));
await cp.goto(`${BASE}${link}`);
await cp.waitForTimeout(1500);
await cp.screenshot({ path: `${shots}/06-client-top.png` });
// scroll through blocks slowly to accumulate dwell
for (let i = 0; i < 12; i++) { await cp.mouse.wheel(0, 600); await cp.waitForTimeout(700); }
// open an accordion
const acc = cp.locator("button[aria-expanded]").first();
if (await acc.count()) await acc.click();
await cp.waitForTimeout(500);
await cp.screenshot({ path: `${shots}/07-client-accordion.png` });
// accept flow on desktop (pointer drawing in Playwright mobile emulation is unreliable)
await cp.waitForTimeout(11000); // let mobile tracker flush
await cp.close();
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const dp = await desk.newPage();
dp.on("pageerror", (e) => console.log("[client pageerror]", e.message));
await dp.goto(`${BASE}${link}`);
await dp.waitForTimeout(1000);
const cp2 = dp;
// 5a. client requests changes
await cp2.locator("text=Request changes").scrollIntoViewIfNeeded();
await cp2.click("text=Request changes");
await cp2.fill('input[autocomplete="name"]', "Sam Khalef");
await cp2.fill('input[autocomplete="email"]', "sam@example.com");
await cp2.fill("textarea", "Can we add the resident app add-on and quote per building?");
await cp2.click("text=Send request");
await cp2.waitForSelector("text=received your requested changes", { timeout: 15000 });
await cp2.screenshot({ path: `${shots}/06b-changes-requested.png` });

// 5b. rep sees feedback and re-opens
await page.goto(`${BASE}/proposals/${proposalId}/analytics`);
await page.waitForSelector("text=Client feedback");
await page.screenshot({ path: `${shots}/06c-feedback-panel.png`, fullPage: true });
await page.click("text=Re-open & notify client");
await page.waitForSelector("text=resolved", { timeout: 15000 });

// 5c. client reloads and signs
await cp2.reload();
await cp2.waitForTimeout(800);
await cp2.locator("text=Accept & sign").scrollIntoViewIfNeeded();
await cp2.click("text=Accept & sign");
await cp2.waitForSelector("text=Sign & accept");
await cp2.fill('input[autocomplete="name"]', "Sam Khalef");
await cp2.fill('input[autocomplete="email"]', "sam@example.com");
const canvas = cp2.locator("canvas");
await canvas.scrollIntoViewIfNeeded();
const box = await canvas.boundingBox();
await cp2.mouse.move(box.x + 20, box.y + 80);
await cp2.mouse.down();
for (let x = 20; x < box.width - 20; x += 10) await cp2.mouse.move(box.x + x, box.y + 60 + 30 * Math.sin(x / 15));
await cp2.mouse.up();
await cp2.check('input[type="checkbox"] >> nth=-1');
await cp2.screenshot({ path: `${shots}/08-client-sign.png`, fullPage: false });
await cp2.waitForTimeout(11000); // let tracker flush a beacon with session id
await cp2.click("text=Sign & accept");
await cp2.waitForSelector("text=awaiting counter-signature", { timeout: 15000 });
await cp2.screenshot({ path: `${shots}/09-client-accepted.png` });

// 5d. rep counter-signs
await page.goto(`${BASE}/proposals/${proposalId}/analytics`);
await page.waitForSelector("text=Counter-sign for MYBOS");
const cc = page.locator("canvas").first();
await cc.scrollIntoViewIfNeeded();
const cb = await cc.boundingBox();
await page.mouse.move(cb.x + 20, cb.y + 60); await page.mouse.down();
for (let x = 20; x < cb.width - 20; x += 12) await page.mouse.move(cb.x + x, cb.y + 50 + 25 * Math.cos(x / 20));
await page.mouse.up();
await page.click("button:has-text('Counter-sign')");
await page.waitForSelector("text=MYBOS", { timeout: 15000 });
await page.waitForFunction(() => document.body.innerText.includes("Signature record") && !document.body.innerText.includes("Counter-sign for MYBOS"), null, { timeout: 15000 });
await cp2.reload();
await cp2.waitForSelector("text=Proposal accepted");
await cp2.locator("text=Download signed PDF").scrollIntoViewIfNeeded();
await cp2.screenshot({ path: `${shots}/09b-client-executed.png` });

// 5e. PDF download (client-side, accepted proposal)
const pdfRes = await cp2.request.get(`${BASE}/api/proposals/${link.split("/p/")[1]}/pdf`);
console.log("pdf status", pdfRes.status(), pdfRes.headers()["content-type"], (await pdfRes.body()).length, "bytes");
import("fs").then((fs) => pdfRes.body().then((b) => fs.writeFileSync(`${shots}/proposal.pdf`, b)));

// 6. analytics
await page.goto(`${BASE}/proposals/${proposalId}/analytics`);
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/10-analytics.png`, fullPage: true });
const text = await page.textContent("body");
console.log("analytics has Signed:", text.includes("Signed"), "views:", /Views\s*(\d+)/.exec(text)?.[1]);

// 7. crm card endpoint (dev fallback)
const card = await (await fetch(`${BASE}/api/hubspot/crm-card?associatedObjectId=123&portalId=dev`)).json();
console.log("crm card", JSON.stringify(card).slice(0, 200));

// 7b. audit log
await page.goto(`${BASE}/settings/audit`);
const auditText = await page.textContent("body");
console.log("audit has countersign:", auditText.includes("proposal.countersign"), "reopen:", auditText.includes("proposal.reopen"));
await page.screenshot({ path: `${shots}/13-audit.png` });

// 8. templates page & settings
await page.goto(`${BASE}/templates`); await page.screenshot({ path: `${shots}/11-templates.png` });
await page.goto(`${BASE}/settings`); await page.screenshot({ path: `${shots}/12-settings.png`, fullPage: true });

await browser.close();
console.log("E2E OK");
