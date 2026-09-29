/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/integrity',
        destination: '/admin/integrity',
        permanent: true,
      },
      {
        source: '/project-schemes',
        destination: '/admin/project-schemes',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
