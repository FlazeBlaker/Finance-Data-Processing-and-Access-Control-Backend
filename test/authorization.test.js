const request = require('supertest');
const app = require('../server');
const prisma = require('../src/utils/prisma');
const bcrypt = require('bcrypt');

describe('Authorization Middleware', () => {
  let viewerToken;
  let analystToken;
  let adminToken;
  let viewerId;
  let analystId;
  let adminId;
  let adminCreatedRecordId; // Record created by admin

  beforeAll(async () => {
    // Create test users with different roles
    const createUser = async (role) => {
      const email = `${role}@test.com`;
      // Clean up if exists (delete records first due to FK constraints)
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true }
      });
      if (existing) {
        await prisma.record.deleteMany({
          where: { userId: existing.id }
        });
        await prisma.user.deleteMany({ where: { email } });
      }

      const hashedPassword = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          name: `${role} User`,
          email,
          password: hashedPassword,
          role,
          isActive: true
        },
        select: { id: true, email: true, role: true }
      });

      // Get token
      const response = await request(app)
        .post('/auth/login')
        .send({ email, password: 'password123' });

      return {
        token: response.body.data.token,
        userId: user.id
      };
    };

    const viewer = await createUser('viewer');
    viewerToken = viewer.token;
    viewerId = viewer.userId;

    const analyst = await createUser('analyst');
    analystToken = analyst.token;
    analystId = analyst.userId;

    const admin = await createUser('admin');
    adminToken = admin.token;
    adminId = admin.userId;

    // Admin creates a record for testing
    const recordResponse = await request(app)
      .post('/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 100,
        type: 'income',
        category: 'Test',
        date: new Date().toISOString(),
        note: 'Test record'
      });

    adminCreatedRecordId = recordResponse.body.data.id;
  });

  afterAll(async () => {
    // Cleanup: Delete all test users and their records
    await prisma.record.deleteMany({
      where: {
        userId: { in: [viewerId, analystId, adminId] }
      }
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['viewer@test.com', 'analyst@test.com', 'admin@test.com'] }
      }
    });
    await prisma.$disconnect();
  });

  describe('POST /records - Admin Only', () => {
    it('should allow admin to create record', async () => {
      const response = await request(app)
        .post('/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 500,
          type: 'expense',
          category: 'Supplies',
          date: new Date().toISOString(),
          note: 'Office supplies'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(500);
    });

    it('should deny viewer from creating record', async () => {
      const response = await request(app)
        .post('/records')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          amount: 100,
          type: 'income',
          category: 'Test',
          date: new Date().toISOString()
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/insufficient permissions/i);
    });

    it('should deny analyst from creating record', async () => {
      const response = await request(app)
        .post('/records')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          amount: 100,
          type: 'income',
          category: 'Test',
          date: new Date().toISOString()
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /records/:id - Admin Only', () => {
    it('should allow admin to update any record', async () => {
      const response = await request(app)
        .put(`/records/${adminCreatedRecordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 150,
          type: 'income',
          category: 'Updated Category',
          date: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(150);
    });

    it('should deny viewer from updating record', async () => {
      const response = await request(app)
        .put(`/records/${adminCreatedRecordId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          amount: 200,
          type: 'expense',
          category: 'Failed Update',
          date: new Date().toISOString()
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /records/:id - Admin Only', () => {
    it('should allow admin to delete record', async () => {
      // Create a new record to delete
      const createResponse = await request(app)
        .post('/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 50,
          type: 'expense',
          category: 'ToDelete',
          date: new Date().toISOString()
        });

      const recordId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/deleted/i);
    });

    it('should deny analyst from deleting record', async () => {
      const response = await request(app)
        .delete(`/records/${adminCreatedRecordId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /records - All Authenticated Users', () => {
    it('should allow viewer to read records', async () => {
      const response = await request(app)
        .get('/records')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should allow analyst to read records', async () => {
      const response = await request(app)
        .get('/records')
        .set('Authorization', `Bearer ${analystToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should allow admin to read records', async () => {
      const response = await request(app)
        .get('/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('totalRecords');
    });
  });
});
