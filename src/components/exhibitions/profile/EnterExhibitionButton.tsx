'use client'

import { Button } from '@/components/ui/Button'

interface EnterExhibitionButtonProps {
  artistSlug: string
  exhibitionSlug: string
  visitUrl: string
  className?: string
}

// Carved out as a client island so the surrounding profile page can
// stay a server component. The only client-side work here is the
// sessionStorage write that lets the visit page know we came from a
// gallery / profile context (for return-URL behavior).
export const EnterExhibitionButton = ({
  artistSlug,
  exhibitionSlug,
  visitUrl,
  className,
}: EnterExhibitionButtonProps) => {
  return (
    <div
      onClick={() => {
        try {
          sessionStorage.setItem(
            'the-art-room:internal-nav',
            JSON.stringify({
              from: 'exhibition',
              returnUrl: `/exhibitions/${artistSlug}/${exhibitionSlug}`,
            }),
          )
        } catch {}
      }}
    >
      <Button
        variant="primary"
        size="bigSquared"
        label="Enter Virtual Exhibition"
        href={visitUrl}
        icon="arrowRight"
        className={className}
      />
    </div>
  )
}
