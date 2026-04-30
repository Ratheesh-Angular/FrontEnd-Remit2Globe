import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Smaller dev graphs (fewer modules resolved per page); pairs with webpack dev to avoid Turbopack OOM on Windows.
  experimental: {
    optimizePackageImports: ["lucide-react", "react-world-flags"],
  },
};

export default nextConfig;
