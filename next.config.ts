import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headless Chromium for PDF export must not be bundled by Turbopack.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
};

export default nextConfig;
