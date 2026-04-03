const { PrismaClient } = require('@prisma/client');

// Use the same test database
process.env.DATABASE_URL = 'file:./test.db';

const prisma = new PrismaClient();

console.log('Global Teardown: Disconnecting test database...');

module.exports = async () => {
  await prisma.$disconnect();
  console.log('Test database disconnected');
};
