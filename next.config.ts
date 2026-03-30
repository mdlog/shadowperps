import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack rooted at this app directory so it does not expand its
    // watch scope higher into `/media/...` when resolving the project tree.
    root: process.cwd(),
  },
};

export default nextConfig;
