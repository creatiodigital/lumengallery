import { cookies } from 'next/headers'
import * as jose from 'jose'

import { serverError } from '@/utils/server-errors'

export const JWT_COOKIE = 'cg-jwt-token'

function getEncodedSecret() {
  const { JWT_SECRET } = process.env

  return new TextEncoder().encode(JWT_SECRET)
}

export async function signJWT(user) {
  const secret = getEncodedSecret()
  const token = await new jose.SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret)

  cookies().set(JWT_COOKIE, token, {
    httpOnly: true,
  })

  return token
}

export async function verifyJWT() {
  try {
    const cookie = cookies().get(JWT_COOKIE)
    const secret = getEncodedSecret()
    const { payload } = await jose.jwtVerify(cookie.value, secret)

    return payload
  } catch (e) {
    return false
  }
}

export async function secureRequest(handler) {
  const verify = await verifyJWT()

  if (!verify) return serverError(401, 'Unauthorized')

  return handler()
}

export function clearJWT() {
  cookies().delete(JWT_COOKIE)
}
