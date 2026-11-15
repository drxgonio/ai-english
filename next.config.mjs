/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build output directory. Override it to build without disturbing a running
  // `next dev` (which locks/rewrites `.next`):
  //   NEXT_DIST_DIR=.next-verify npm run build
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  // The OpenAI SDK is only imported from Node.js route handlers, so it must not
  // be bundled into the client/edge graph. Keeping the default `nodejs` runtime
  // plus serverExternalPackages avoids issues with the SDK's dynamic requires.
  serverExternalPackages: ["openai"],
  eslint: {
    // `next lint` was removed from the build pipeline in recent versions; a
    // missing lint config should never block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
