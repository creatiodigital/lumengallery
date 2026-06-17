'use client'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Text } from '@/components/ui/Typography'

import styles from './EnterExhibitionButton.module.scss'

interface EnterExhibitionButtonProps {
  artistSlug: string
  exhibitionSlug: string
  visitUrl: string
  className?: string
}

// Carved out as a client island so the surrounding profile page can stay a
// server component. The 3D walk-through needs a laptop-or-wider VIEWPORT (the
// /visit route blocks anything narrower, regardless of device), so here we show
// the real CTA only at desktop widths and swap in a friendly note below it — no
// tap that would only turn the visitor away. Desktop vs mobile is decided purely
// by viewport via CSS media queries (no user-agent sniffing), matching the
// /visit guard's 1024px threshold. The only client work is the sessionStorage
// write that tells the visit page where to return.
export const EnterExhibitionButton = ({
  artistSlug,
  exhibitionSlug,
  visitUrl,
  className,
}: EnterExhibitionButtonProps) => {
  const rememberReturn = () => {
    try {
      sessionStorage.setItem(
        'the-art-room:internal-nav',
        JSON.stringify({
          from: 'exhibition',
          returnUrl: `/exhibitions/${artistSlug}/${exhibitionSlug}`,
        }),
      )
    } catch {}
  }

  return (
    <>
      <div className={styles.desktopCta} onClick={rememberReturn}>
        <Button
          variant="primary"
          size="bigSquared"
          label="Enter Virtual Exhibition"
          href={visitUrl}
          icon="arrowRight"
          className={className}
        />
      </div>

      <div className={styles.mobileNotice}>
        <span className={styles.mobileNoticeIcon}>
          <Icon name="monitor" size={22} color="currentColor" />
        </span>
        <div className={styles.mobileNoticeBody}>
          <Text as="span" size="xs" className={styles.mobileNoticeLabel}>
            Virtual exhibition
          </Text>
          <Text as="p" size="sm" className={styles.mobileNoticeText}>
            Also available as an immersive 3D space — open this page on a laptop or desktop to step
            inside.
          </Text>
        </div>
      </div>
    </>
  )
}
