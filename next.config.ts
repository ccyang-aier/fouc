import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ['@fouc/shared'],
  output: "export",
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
