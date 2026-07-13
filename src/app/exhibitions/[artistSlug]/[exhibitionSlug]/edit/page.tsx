import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { ExhibitionEditPage } from '@/components/exhibitions/edit'

interface ExhibitionEditProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
  searchParams: Promise<{ wallId?: string; artworkId?: string }>
}

const ExhibitionEdit = async ({ params, searchParams }: ExhibitionEditProps) => {
  // Server-side auth gate (defense-in-depth alongside middleware). Ownership
  // itself is enforced by the mutation APIs and the client shell; this just
  // ensures no unauthenticated visitor ever renders the authoring surface.
  const session = await auth()
  if (!session?.user) {
    redirect('/dashboard/login')
  }

  const { artistSlug, exhibitionSlug } = await params
  const { wallId, artworkId } = await searchParams
  return (
    <ExhibitionEditPage
      artistSlug={artistSlug}
      exhibitionSlug={exhibitionSlug}
      initialWallId={wallId}
      initialArtworkId={artworkId}
    />
  )
}

export default ExhibitionEdit
