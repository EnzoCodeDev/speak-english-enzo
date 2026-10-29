import type { NextConfig } from "next";

// Export estático: `next build` deja la web en `out/`, lista para servirla con
// Caddy (ver Dockerfile). La app no necesita servidor: todo vive en el navegador.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
