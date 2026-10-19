import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

function buildCommit() {
  const supplied = process.env.VERCEL_GIT_COMMIT_SHA;
  if (supplied && /^[a-f0-9]{40}$/i.test(supplied)) return supplied;
  try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return ""; }
}
function buildDirty() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return "false";
  try { return String(!!execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()); }
  catch { return "unknown"; }
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: { FINBRIDGE_BUILD_COMMIT: buildCommit(), FINBRIDGE_BUILD_DIRTY: buildDirty() },
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    // Preserve cached pages, bookmarks and saved image URLs after the asset move.
    return [
      { source: "/sites/rolly/images/Rolly-365-streak-removebg-preview.png", destination: "/finbridge/images/monthly-streak.png", permanent: true },
      { source: "/sites/rolly/:path*", destination: "/finbridge/:path*", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
      // Deliberately scope enforcement to directives compatible with Next inline
      // hydration, local/data images, Google OAuth redirects and media input.
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://accounts.google.com" },
    ] }];
  },
};

export default nextConfig;
