import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/client-runtime-utils'],
  // Stamp the deployed commit SHA into the client bundle so a running tab knows
  // which build it booted. Compared against the server's live SHA (/api/version)
  // to detect users stuck on a stale/cached version. Vercel sets
  // VERCEL_GIT_COMMIT_SHA at build; 'dev' locally.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Custom sizes for our image optimization presets (thumbnail: 400, gallery3D: 1024, isolated: 2048)
    deviceSizes: [640, 750, 828, 1024, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 400],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.theartroom.gallery',
        pathname: '/**',
      },
      {
        // Legacy: dev DB still has old Vercel Blob URLs
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },

  // Cache headers for optimal performance
  async headers() {
    return [
      // Global security headers
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // Static 3D assets - cache forever (1 year)
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Draco decoder files - cache forever
      {
        source: '/draco/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Visit routes - revalidate on each visit (exhibition data may change after publish)
      {
        source: '/exhibitions/:artistSlug/:exhibitionSlug/visit',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Exhibition profile pages - revalidate (snapshot data may update)
      {
        source: '/exhibitions/:artistSlug/:exhibitionSlug',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Exhibition API routes - revalidate
      {
        source: '/api/exhibitions/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Edit routes - never cache (artists need real-time updates)
      {
        source: '/exhibitions/:artistSlug/:exhibitionSlug/edit',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    })

    return config
  },

  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}

export default withSentryConfig(nextConfig, {
  // Proxy client-side Sentry events through our own domain instead of
  // *.ingest.sentry.io, which ad blockers / privacy extensions / Brave block.
  // Without this, a large share of browser errors silently never arrive.
  tunnelRoute: '/monitoring',

  // Upload source maps for readable stack traces in Sentry
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress Sentry CLI logs during build
  silent: !process.env.CI,

  // Disable Sentry telemetry
  telemetry: false,
})
