import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

import prisma from '@/lib/prisma'
import { generateProvisionalPassword, validatePassword } from '@/utils/password'

// GET all artists — read fresh so new/edited artists appear immediately.
export async function GET() {
  try {
    const artists = await prisma.user.findMany({
      where: { userType: 'artist', published: true },
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
    return NextResponse.json(artists)
  } catch (error) {
    console.error('[GET /api/artists] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create new artist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, lastName, handler, email, biography, password, userType } = body

    // Validate required fields
    if (!name || !lastName || !handler || !email) {
      return NextResponse.json(
        { error: 'Name, lastName, handler, and email are required' },
        { status: 400 },
      )
    }

    // Determine password: use provided or auto-generate provisional
    let rawPassword = password as string | undefined
    let isProvisional = false

    if (!rawPassword) {
      rawPassword = generateProvisionalPassword()
      isProvisional = true
    } else {
      // Validate manual password
      const validation = validatePassword(rawPassword)
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Password must have ${validation.errors.join(', ')}` },
          { status: 400 },
        )
      }
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10)

    const artist = await prisma.user.create({
      data: {
        name,
        lastName,
        handler,
        email,
        biography: biography || '',
        password: hashedPassword,
        mustChangePassword: isProvisional,
        userType: userType || 'artist',
      },
    })

    // Refresh the homepage's featured-artists strip.
    revalidatePath('/')

    return NextResponse.json(
      { ...artist, provisionalPassword: isProvisional ? rawPassword : undefined },
      { status: 201 },
    )
  } catch (error: unknown) {
    console.error('[POST /api/artists] error:', error)

    // Handle unique constraint errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Handler or email already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: 'Failed to create artist' }, { status: 500 })
  }
}
