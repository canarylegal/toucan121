import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slim production image for TrueNAS / Docker (copies server + static assets).
  output: "standalone",
  // Allow HMR / dev assets when using the public Cloudflare hostname in development.
  allowedDevOrigins: ["toucan121.co.uk", "www.toucan121.co.uk"],
  async redirects() {
    return [
      {
        source: "/host",
        destination: "/dash",
        permanent: true,
      },
      {
        source: "/host/:path*",
        destination: "/dash/:path*",
        permanent: true,
      },
      {
        source: "/book/:hostSlug",
        destination: "/:hostSlug",
        permanent: true,
      },
      {
        source: "/book/:hostSlug/:meetingTypeSlug",
        destination: "/:hostSlug/:meetingTypeSlug",
        permanent: true,
      },
      {
        source: "/book/:hostSlug/confirmed/:bookingId",
        destination: "/:hostSlug/confirmed/:bookingId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
