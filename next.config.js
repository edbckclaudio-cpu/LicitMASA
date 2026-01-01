/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  async rewrites() {
    return [
      { source: '/OneSignalSDKWorker.js', destination: '/OneSignalSDKWorker.js' },
    ]
  },
  async headers() {
    return [
      {
        source: '/OneSignalSDKWorker.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
