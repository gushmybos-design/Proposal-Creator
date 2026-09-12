import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

/**
 * Server-side PDF rendering of a proposal: headless Chromium loads the public page in
 * "pdf mode" (no banners, no tracking, no interactive controls) and prints it.
 *
 * - On Vercel/AWS Lambda we use @sparticuz/chromium (a Lambda-compatible Chromium build).
 * - Locally we use the Chromium that ships with Playwright, or CHROME_PATH if set.
 *
 * The page is fetched with a signed `pdf_key` so drafts render without a user session.
 */
export function pdfKey(token: string) {
  return createHmac("sha256", env.sessionSecret).update(`pdf:${token}`).digest("hex").slice(0, 32);
}
export function verifyPdfKey(token: string, key: string) {
  try {
    return timingSafeEqual(Buffer.from(pdfKey(token)), Buffer.from(key));
  } catch {
    return false;
  }
}

async function launch() {
  const { chromium } = await import("playwright-core");
  const onLambda = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (onLambda) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({ args: sparticuz.args, executablePath: await sparticuz.executablePath(), headless: true });
  }
  return chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
}

export async function renderProposalPdf(token: string): Promise<Buffer> {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
    // Use the internal URL when available (Vercel gives us the deployment host), else APP_URL.
    const base = process.env.PDF_RENDER_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : env.appUrl);
    await page.goto(`${base}/p/${token}?pdf=1&pdf_key=${pdfKey(token)}`, { waitUntil: "networkidle", timeout: 45_000 });
    await page.emulateMedia({ media: "print" });
    await page.addStyleTag({ content: PRINT_CSS });
    await page.waitForTimeout(300);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

const PRINT_CSS = `
  * { animation: none !important; transition: none !important; }
  section { break-inside: avoid; }
  iframe, video { display: none !important; }
  button, [role=button] { display: none !important; }
  a[href^="/api/proposals"] { display: none !important; }
  .min-h-\\[70vh\\] { min-height: 0 !important; padding-top: 6rem !important; }
`;
