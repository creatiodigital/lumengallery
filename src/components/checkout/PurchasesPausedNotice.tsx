import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'

type Props = {
  /** Page title so the notice keeps the surface's identity (Cart, Checkout…). */
  title: string
}

/**
 * Buyer-facing stand-in rendered by every purchase route (wizard, cart,
 * checkout) while the admin's purchases kill switch is on — covers deep
 * links and bookmarks that bypass the hidden CTAs. Nothing here mentions
 * problems; sales are simply "paused".
 */
export const PurchasesPausedNotice = ({ title }: Props) => (
  <PageLayout>
    <PageHeader pageTitle={title} />
    <EmptyState message="Purchases are temporarily paused — please check back soon." />
    <Button variant="secondary" size="bigSquared" href="/" label="Back to the gallery" />
  </PageLayout>
)
