import { NextResponse } from 'next/server'

import { auth } from '@/auth'

// Role hierarchy constants
const ADMIN_ROLES = ['admin', 'superAdmin'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

/**
 * Check if userType is superAdmin
 */
export function isSuperAdmin(userType: string | undefined): boolean {
  return userType === 'superAdmin'
}

/**
 * Check if userType is admin or superAdmin
 */
export function isAdminOrAbove(userType: string | undefined): boolean {
  return ADMIN_ROLES.includes(userType as AdminRole)
}

/**
 * Determine if actor can modify target user based on role hierarchy
 * - superAdmin can modify anyone
 * - admin can modify anyone EXCEPT superAdmin
 * - others cannot modify users
 */
export function canModifyUser(
  actorUserType: string | undefined,
  targetUserType: string | undefined,
): boolean {
  if (isSuperAdmin(actorUserType)) {
    return true
  }
  if (actorUserType === 'admin') {
    return !isSuperAdmin(targetUserType)
  }
  return false
}

/**
 * Get authenticated session or return unauthorized response
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { session, error: null }
}

/**
 * Verify the authenticated user owns the resource
 * @param resourceUserId - The userId associated with the resource
 */
export async function requireOwnership(resourceUserId: string) {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  // SuperAdmins can operate on any resource
  if (isSuperAdmin(session!.user.userType)) {
    return { session, error: null }
  }

  // Allow if user owns the resource OR is impersonating the owner
  const effectiveUserId = session!.impersonating?.id || session!.user.id

  if (effectiveUserId !== resourceUserId) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Server-ACTION variant of the admin gate: returns a plain {ok, error}
 * result instead of a NextResponse (actions return values to the client,
 * they don't short-circuit with a Response). THE single admin guard for
 * server actions — do not copy it into action files.
 */
export async function requireAdminAction() {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: 'Not signed in.' }
  if (!isAdminOrAbove(session.user.userType)) {
    return { ok: false as const, error: 'Admin access required.' }
  }
  return { ok: true as const, session }
}

/**
 * Require admin or superAdmin role
 */
export async function requireAdminOrAbove() {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  if (!isAdminOrAbove(session!.user.userType)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden - Admin required' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Require superAdmin role only
 */
export async function requireSuperAdmin() {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  if (!isSuperAdmin(session!.user.userType)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden - Super Admin required' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Legacy alias for requireAdminOrAbove (for backward compatibility)
 */
export const requireAdmin = requireAdminOrAbove

/**
 * Get the effective user ID (handles impersonation)
 */
export async function getEffectiveUserId() {
  const { session, error } = await requireAuth()

  if (error) {
    return { userId: null, error }
  }

  const userId = session!.impersonating?.id || session!.user.id

  return { userId, error: null }
}
