/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  async rewrites() {
    return [
      { source: '/OneSignalSDKWorker.js', destination: '/OneSignalSDKWorker.js' },
    ]
  },
}
module.exports = nextConfig
