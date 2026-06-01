import c from 'classnames'
import sanitizeHtml from 'sanitize-html'

import styles from './RichText.module.scss'

type RichTextProps = {
  content: string
  className?: string
  /**
   * Predefined style variants:
   * - 'default': Large serif text for editorial content (biographies, descriptions)
   * - 'compact': Smaller sans-serif text for artwork metadata (technique, dimensions)
   */
  variant?: 'default' | 'compact'
}

// Server-safe sanitizer. `sanitize-html` is pure JS (no jsdom), unlike the
// previous `isomorphic-dompurify`, whose jsdom dependency threw at Vercel's
// serverless runtime and 500'd any server-rendered CMS page — which is why
// those pages had to stay static. This mirrors the old DOMPurify allowlist 1:1
// so nothing renders differently. DOMPurify's ALLOWED_ATTR was global, so all
// four attributes map to '*'.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'code',
    'pre',
    'span',
    'div',
  ],
  allowedAttributes: { '*': ['href', 'target', 'rel', 'class'] },
  // Only safe link schemes — blocks javascript:/data: hrefs.
  allowedSchemes: ['http', 'https', 'mailto'],
  // Drop unknown/disallowed tags entirely (matches DOMPurify's behavior).
  disallowedTagsMode: 'discard',
}

export const RichText = ({ content, className, variant = 'default' }: RichTextProps) => {
  if (!content) return null

  // Sanitize HTML to prevent XSS attacks.
  const sanitizedContent = sanitizeHtml(content, SANITIZE_OPTIONS)

  return (
    <div
      className={c(styles.richText, variant === 'compact' && styles.compact, className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}
