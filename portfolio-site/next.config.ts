import type { NextConfig } from "next";

// Static export: the site is plain HTML, CSS and images in `out/`, so it can be hosted anywhere.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
