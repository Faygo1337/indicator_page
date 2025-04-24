import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gmgn.ai",
        port: "",
        pathname: "/external-res/**"
      },
      {
        protocol: "https",
        hostname: "dd.dexscreener.com",
        port: "",
        pathname: "/ds-data/tokens/**"
      },
      {
        protocol: "https",
        hostname: "whales.trace.foundation",
        port: "",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "pump.mypinata.cloud",
        port: "",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "/**"
      }
    ],
    unoptimized: true
  }
};

export default nextConfig;


/** @type {import('next').NextConfig} */
