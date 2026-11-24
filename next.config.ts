import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones on the local Wi-Fi load the dev server (dev only; ignored in production).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
