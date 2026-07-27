import { readFileSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  try {
    const file = readFileSync(join(process.cwd(), 'public', 'flowsara-logo.jpg'))
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
