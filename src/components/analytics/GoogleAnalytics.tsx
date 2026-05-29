import Script from 'next/script'

/**
 * Loads Google Analytics 4 with Consent Mode v2.
 *
 * - Renders nothing unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set. We only set
 *   that var in Vercel's Production environment, so staging and local never
 *   load GA and never pollute the gallery's real analytics data.
 * - All storage starts `denied`. GA sends only cookieless pings until the
 *   user accepts in the cookie banner, at which point `analytics_storage`
 *   flips to `granted` (see src/lib/consent.ts). We only use analytics, so
 *   the ad_* signals stay denied permanently.
 * - On startup we replay any previously stored consent so returning visitors
 *   who already accepted are measured immediately.
 */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export const GoogleAnalytics = () => {
  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        id="ga-consent-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied'
            });
            try {
              var stored = JSON.parse(window.localStorage.getItem('cookie-consent'));
              if (stored && stored.analytics === true) {
                gtag('consent', 'update', { analytics_storage: 'granted' });
              }
            } catch (e) {}
            gtag('config', '${GA_MEASUREMENT_ID}');
          `,
        }}
      />
      <Script
        id="ga-lib"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
    </>
  )
}
