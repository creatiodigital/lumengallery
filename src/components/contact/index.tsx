'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import styles from './Contact.module.scss'

export const ContactPage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Contact Us"
        pageSubtitle="For inquiries, exhibitions, and collaborations."
      />

      <div className={styles.grid}>
        <div className={styles.column}>
          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              EMAIL
            </Text>
            <a href="mailto:contact@theartroom.gallery" className={styles.email}>
              contact@theartroom.gallery
            </a>
          </div>

          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              LOCATIONS
            </Text>
            <Text font="serif" className={styles.value}>
              Madrid &nbsp;&nbsp;&nbsp; Vienna
            </Text>
          </div>
        </div>

        <div className={styles.column}>
          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              CONTACT
            </Text>
            <Text as="p" font="serif" className={styles.value}>
              The Art Room welcomes inquiries related to exhibitions, artworks, and artist
              collaborations.
            </Text>
          </div>

          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              SUBMISSION
            </Text>
            <Text as="p" font="serif" className={styles.value}>
              Submissions and proposals are by invitation only.
            </Text>
            <Text as="p" size="sm" className={styles.note}>
              For institutional partnerships and curatorial inquiries, please direct correspondence
              to the email address above.
            </Text>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
