/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure server options
  serverRuntimeConfig: {
    // Server-side only config
  },

  // Configure public runtime options
  publicRuntimeConfig: {
    // Config accessible on both server and client
  },

  // Optimize for production
  swcMinify: true,
  
  // Increase the timeout for page generation
  staticPageGenerationTimeout: 120,

  // Configure response headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
