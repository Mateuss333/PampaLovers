import path from "node:path";
import { fileURLToPath } from "node:url";

// Absolute path to this Next app (directory that contains package.json + node_modules/next).
// Required so Turbopack does not infer the wrong root when a second package-lock.json exists
// at the monorepo parent (PampaLovers/) or when the tool cwd is ambiguous.
const projectRoot = path.normalize(path.resolve(path.dirname(fileURLToPath(import.meta.url))));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
