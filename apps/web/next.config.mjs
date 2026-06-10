/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Amplify uses ES modules internally — Next.js 14 needs to transpile them.
  transpilePackages: ["aws-amplify", "@aws-amplify/auth", "@aws-amplify/core"],

  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
