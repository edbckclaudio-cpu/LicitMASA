/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  async rewrites() {
    return [
      { source: '/OneSignalSDKWorker.js', destination: '/OneSignalSDKWorker.js' },
      { source: '/manifest.json', destination: '/manifest.webmanifest' },
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
      {
        source: '/OneSignalSDKUpdaterWorker.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
