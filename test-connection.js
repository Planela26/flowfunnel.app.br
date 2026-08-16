require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

(async () => {
  try {
    console.log('Testando conexão com DATABASE_URL:');
    console.log(process.env.DATABASE_URL.substring(0, 50) + '...');

    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Conexão bem-sucedida!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Erro de conexão:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
