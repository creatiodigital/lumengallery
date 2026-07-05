/**
 * Reasons a print order can be re-ordered (replacement reprint). Shared by the
 * server action (`reorderForReprint`) and the admin UI. Lives outside the
 * `'use server'` actions module, which may only export async functions.
 * See docs/superpowers/specs/2026-06-26-reorder-reprint-design.md.
 */
export const REORDER_REASONS = ['damaged', 'wrong_size', 'print_quality', 'other'] as const
export type ReorderReason = (typeof REORDER_REASONS)[number]
export const REORDER_REASON_LABELS: Record<ReorderReason, string> = {
  damaged: 'Damaged in transit',
  wrong_size: 'Wrong size',
  print_quality: 'Print quality',
  other: 'Other',
}
