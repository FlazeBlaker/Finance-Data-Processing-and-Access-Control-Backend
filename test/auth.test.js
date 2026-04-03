const request = require('supertest');
const app = require('../server');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../src/utils/prisma');

describe('Authentication Endpoints', () => {
  let authToken;
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'viewer'
  };

  beforeAll(async () => {
    // Clean up any existing test data (delete records first due to foreign key)
    const existingUser = await prisma.user.findUnique({
      where: { email: testUser.email },
      select: { id: true }
    });
    if (existingUser) {
      await prisma.record.deleteMany({
        where: { userId: existingUser.id }
      });
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
    }
  });

  afterAll(async () => {
    // Clean up test data (delete records first due to FK constraints)
    const user = await prisma.user.findUnique({
      where: { email: testUser.email },
      select: { id: true }
    });
    if (user) {
      await prisma.record.deleteMany({
        where: { userId: user.id }
      });
      await prisma.user.deleteMany({
        where: { email: testUser.email }
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.role).toBe(testUser.role);
      expect(response.body.data.password).toBeUndefined();
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ name: 'John Doe' }) // Missing email and password
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/required/i);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'invalidemail',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid email/i);
    });

    it('should reject short password (< 6 characters)', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: '12345' // 5 characters
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/at least 6/i);
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          role: 'superuser' // Invalid role
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/allowed roles/i);
    });

    it('should reject duplicate email', async () => {
      // First register should succeed (already done in beforeAll)
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/already registered|already exists/i);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(testUser.email);

      // Save token for other tests
      authToken = response.body.data.token;
    });

    it('should fail with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('should fail with non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/invalid credentials/i);
    });

    it('should fail with missing email or password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: testUser.email }) // Missing password
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/required/i);
    });
  });
});
