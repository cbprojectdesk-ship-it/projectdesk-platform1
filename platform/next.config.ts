import type { NextConfig } from "next";
import { securityHeaderEntries } from "./server/security-headers.mjs";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaderEntries() }];
  },
};

export default nextConfig;
