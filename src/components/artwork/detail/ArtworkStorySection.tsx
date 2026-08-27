import { RichText } from '@/components/ui/RichText'
import { isRichTextEmpty } from '@/lib/textUtils'

import styles from './ArtworkStorySection.module.scss'

/**
 * The artwork's own story, full width and at reading measure.
 *
 * On the standalone page this leaves the cramped metadata column and becomes a
 * piece of writing in its own right — an essay about the work rather than a
 * product description. Absent entirely when the artwork has no description,
 * which is most of them and is not a degraded state.
 *
 * The in-exhibition modal keeps the description in its metadata column instead;
 * a full-width essay does not belong in an overlay over a 3D room.
 */
export const ArtworkStorySection = ({ description }: { description?: string | null }) => {
  // `isRichTextEmpty` covers null, undefined, whitespace and tag-only HTML — an
  // empty TipTap document is "<p></p>", not "". Without that last case the
  // section would render a rule and a blank space on most artworks.
  if (isRichTextEmpty(description)) return null

  return (
    <section className={styles.story}>
      <RichText content={description!} className={styles.body} />
    </section>
  )
}
