import type { Metadata } from 'next'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { Text } from '@/components/ui/Typography'
import { Slideshow } from '@/components/landing/Slideshow'
import { Intro } from '@/components/landing/Intro/Intro'
import { NiceTitle } from '@/components/landing/NiceTitle/NiceTitle'
import { FeaturedArtists } from '@/components/landing/FeaturedArtists/FeaturedArtists'
import { ExhibitionGrid } from '@/components/exhibitions/ExhibitionGrid'
import prisma from '@/lib/prisma'

import styles from './page.module.scss'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room' },
  description:
    'Explore curated virtual exhibitions in immersive 3D gallery spaces. Discover contemporary art beyond immediacy.',
}

// Render per request and read straight from the DB so admin edits (slides,
// exhibitions, featured artists) appear immediately. No data cache.
export const dynamic = 'force-dynamic'

const getSlides = async () => {
  const slidesData = await prisma.slide.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })
  return slidesData.map((slide) => ({
    id: slide.id,
    imageUrl: slide.imageUrl,
    exhibitionUrl: slide.exhibitionUrl,
    meta: slide.meta,
    title: slide.title,
    subtitle: slide.subtitle,
    textColor: slide.textColor,
  }))
}

const getExhibitions = async () => {
  const exhibitionData = await prisma.exhibition.findMany({
    where: {
      status: 'current',
      published: true,
    },
    include: {
      user: {
        select: {
          name: true,
          lastName: true,
          handler: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })
  return exhibitionData as unknown as ExhibitionWithUser[]
}

const getFeaturedArtists = async () => {
  return prisma.user.findMany({
    where: {
      isFeatured: true,
      published: true,
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      handler: true,
      biography: true,
      profileImageUrl: true,
    },
    orderBy: { name: 'asc' },
  })
}

type ExhibitionWithUser = {
  id: string
  mainTitle: string
  url: string
  featuredImageUrl: string | null
  shortDescription: string | null
  user: { name: string; lastName: string; handler: string }
}

export default async function Home() {
  const slides = await getSlides()
  const exhibitions = await getExhibitions()
  const featuredArtists = await getFeaturedArtists()

  return (
    <main id="main-content" className={styles.home}>
      <Header borderless />

      <Text as="h1" className={styles.srOnly}>
        The Art Room
      </Text>

      {slides.length > 0 && <Slideshow slides={slides} />}

      <div className={styles.content}>
        <Intro />

        <NiceTitle title="Current Exhibitions" />

        <section className={styles.exhibitionsSection}>
          {exhibitions.length === 0 ? (
            <Text as="p" className={styles.emptyText}>
              No current exhibitions at the moment.
            </Text>
          ) : (
            <ExhibitionGrid
              exhibitions={exhibitions.map((exhibition) => ({
                id: exhibition.id,
                mainTitle: exhibition.mainTitle,
                featuredImageUrl: exhibition.featuredImageUrl,
                shortDescription: exhibition.shortDescription,
                artistLabel: `${exhibition.user.name} ${exhibition.user.lastName}`,
                href: `/exhibitions/${exhibition.user.handler}/${exhibition.url}`,
              }))}
            />
          )}
        </section>

        <FeaturedArtists artists={featuredArtists} />
      </div>

      <Footer />
    </main>
  )
}
