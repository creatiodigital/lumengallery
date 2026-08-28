import Link from 'next/link'

import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'

import { Text } from '@/components/ui/Typography'
import { NiceTitle } from '@/components/landing/NiceTitle/NiceTitle'

import styles from './FeaturedArtists.module.scss'

type FeaturedArtist = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  profileImageUrl: string | null
}

interface FeaturedArtistsProps {
  artists: FeaturedArtist[]
}

export const FeaturedArtists = ({ artists }: FeaturedArtistsProps) => {
  if (artists.length === 0) return null

  return (
    <section className={styles.section}>
      <NiceTitle title="Featured Artists" />

      <div className={styles.grid}>
        {artists.map((artist, i) => (
          <Link key={artist.id} href={`/artists/${artist.handler}`} className={styles.artistRow}>
            <div className={styles.artistInfo}>
              <span className={styles.index}>({String(i + 1).padStart(2, '0')})</span>
              <Text as="span" font="serif" size="2xl">
                {artist.name} {artist.lastName}
              </Text>
            </div>
            {artist.profileImageUrl && (
              <ProtectedImage
                src={artist.profileImageUrl}
                alt={`${artist.name} ${artist.lastName}`}
                width={200}
                height={140}
                wrapperClassName={styles.imageContainer}
                className={styles.profileImage}
              />
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
