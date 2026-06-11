import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import {
  bodyFont,
  headingFont,
  dashboardFont,
  editionNumberFont,
  wallFont1,
  wallFont2,
  wallFont3,
  wallFont4,
  wallFont5,
  wallFont6,
} from '@/app/fonts'
import StoreProvider from '@/app/storeProvider'
import { GoogleAnalytics } from '@/components/analytics'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ImageProtection } from '@/components/providers/ImageProtection'
import { CookieBanner } from '@/components/ui/CookieBanner'
import { NavigationProgressBar } from '@/components/ui/NavigationProgressBar'
import { VersionGuard } from '@/components/observability/VersionGuard'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import '@/styles/globals.scss'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
const IS_PROD = process.env.NEXT_PUBLIC_APP_ENV === 'production'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Art Room',
    template: 'The Art Room: %s',
  },
  description:
    'Explore curated virtual exhibitions in immersive 3D gallery spaces. Discover contemporary art beyond immediacy.',
  openGraph: {
    type: 'website',
    siteName: 'The Art Room',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  // Only allow indexing on production. Staging and any preview deploys
  // emit <meta name="robots" content="noindex,nofollow"> so search
  // engines don't pick up test content.
  robots: IS_PROD
    ? { index: true, follow: true }
    : {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
}

type RootLayoutProps = {
  children: ReactNode
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'The Art Room',
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  description:
    'Virtual exhibition space dedicated to showcasing contemporary art in immersive 3D environments.',
  sameAs: [],
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable} ${dashboardFont.variable} ${editionNumberFont.variable} ${wallFont1.variable} ${wallFont2.variable} ${wallFont3.variable} ${wallFont4.variable} ${wallFont5.variable} ${wallFont6.variable}`}
    >
      <body>
        {/* Preconnect to the image CDN so the hero image's TLS handshake
            overlaps with HTML parsing. React 19 auto-hoists <link> to the
            document head, so we render it inside <body> rather than a
            literal <head> — the explicit-<head> pattern conflicts with
            generateMetadata + RSC streaming on Vercel's runtime. */}
        <link rel="preconnect" href="https://assets.theartroom.gallery" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <NavigationProgressBar />
        <AuthProvider>
          <StoreProvider>
            <ImageProtection />
            <header></header>
            {children}
          </StoreProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
        <CookieBanner />
        <GoogleAnalytics />
        <VersionGuard />
      </body>
    </html>
  )
}
