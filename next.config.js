/** @type {import('next').NextConfig} */
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

const nextConfig = {
  output: "standalone",
  async rewrites() {
    if (!apiBaseUrl) {
      return [];
    }
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${apiBaseUrl.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
