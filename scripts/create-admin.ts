import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL!
  const password = process.env.ADMIN_PASSWORD!
  const hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, role: 'ADMIN' },
    create: {
      email,
      password: hash,
      role: 'ADMIN',
      name: 'Admin',
      plan: 'SCALE',
    },
  })
  console.log('OK:', user.email, user.role)
}

main().finally(() => prisma.$disconnect())
