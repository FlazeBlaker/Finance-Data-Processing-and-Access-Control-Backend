const { PrismaClient } = require('@prisma/client');

// Create a single instance of PrismaClient that will be shared across the app
let prisma;

if (process.env.NODE_ENV === 'production') {
  // In production, create the instance normally
  prisma = new PrismaClient();
} else {
  // In development, prevent multiple instances during hot-reload
  // This avoids "PrismaClient is already instantiated" errors
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

// Optional: Log queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    console.log('Query:', e.query);
    console.log('Params:', e.params);
    console.log('Duration:', e.duration, 'ms');
  });
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
