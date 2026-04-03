const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Use a separate test database
process.env.DATABASE_URL = 'file:./test.db';

const testDbPath = path.join(__dirname, '..', 'test.db');

// Delete existing test database for clean state
if (fs.existsSync(testDbPath)) {
  console.log('Deleting existing test.db for clean state...');
  fs.unlinkSync(testDbPath);
}

// Global hook to make prisma available to the singleton pattern used in src/utils/prisma.js
global.__prisma = new PrismaClient();

console.log('Test database initialized: test.db');

// Run migrations to ensure schema is up to date
try {
  console.log('Running Prisma migrations for test database...');
  execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', { stdio: 'inherit' });
  console.log('Test database migration complete');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}

module.exports = async () => {
  // Jest globalSetup expects a function
  // Everything is already done above during module initialization
  console.log('Global setup complete');
};
