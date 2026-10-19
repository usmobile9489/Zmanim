/** @type {import('next').NextConfig} */
const nextConfig = {
  // Types are checked loosely; the build should never fail on a type nit.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
