export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars
    .replace(/\s+/g, '-') // spaces to dashes
    .replace(/--+/g, '-') // collapse multiple dashes
}
