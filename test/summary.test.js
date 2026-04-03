const request = require('supertest');
const app = require('../server');
const prisma = require('../src/utils/prisma');
const bcrypt = require('bcrypt');

describe('Summary Endpoints', () => {
  let adminToken;
  let viewerToken;

  beforeAll(async () => {
    // Create an admin user for creating test data
    const adminEmail = 'admin-summary@test.com';
    // Clean up existing admin (delete records first due to FK)
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true }
    });
    if (existingAdmin) {
      await prisma.record.deleteMany({
        where: { userId: existingAdmin.id }
      });
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    }

    const hashedPassword = await bcrypt.hash('password123', 10);
    const admin = await prisma.user.create({
      data: {
        name: 'Admin Summary',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isActive: true
      }
    });

    // Get admin token
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: adminEmail, password: 'password123' });
    adminToken = loginRes.body.data.token;

    // Create test records for this admin
    const testRecords = [
      { amount: 5000, type: 'income', category: 'Salary', date: new Date('2025-04-01') },
      { amount: 2000, type: 'income', category: 'Freelance', date: new Date('2025-04-05') },
      { amount: 1500, type: 'expense', category: 'Rent', date: new Date('2025-04-02') },
      { amount: 800, type: 'expense', category: 'Food', date: new Date('2025-04-10') },
      { amount: 1200, type: 'expense', category: 'Utilities', date: new Date('2025-03-15') }, // March record
      { amount: 3000, type: 'income', category: 'Investment', date: new Date('2025-03-20') } // March record
    ];

    for (const record of testRecords) {
      await prisma.record.create({
        data: {
          ...record,
          userId: admin.id
        }
      });
    }

    // Create a viewer token for testing access
    const viewerEmail = 'viewer-summary@test.com';
    const existingViewer = await prisma.user.findUnique({
      where: { email: viewerEmail },
      select: { id: true }
    });
    if (existingViewer) {
      await prisma.record.deleteMany({
        where: { userId: existingViewer.id }
      });
      await prisma.user.deleteMany({ where: { email: viewerEmail } });
    }
    const viewer = await prisma.user.create({
      data: {
        name: 'Viewer Summary',
        email: viewerEmail,
        password: hashedPassword,
        role: 'viewer',
        isActive: true
      }
    });

    const viewerLogin = await request(app)
      .post('/auth/login')
      .send({ email: viewerEmail, password: 'password123' });
    viewerToken = viewerLogin.body.data.token;
  });

  afterAll(async () => {
    // Cleanup: Get user IDs first
    const users = await prisma.user.findMany({
      where: {
        email: { in: ['admin-summary@test.com', 'viewer-summary@test.com'] }
      },
      select: { id: true }
    });
    const userIds = users.map(u => u.id);

    // Delete records first (to avoid foreign key constraint)
    if (userIds.length > 0) {
      await prisma.record.deleteMany({
        where: { userId: { in: userIds } }
      });
    }

    // Then delete users
    await prisma.user.deleteMany({
      where: {
        email: { in: ['admin-summary@test.com', 'viewer-summary@test.com'] }
      }
    });
    await prisma.$disconnect();
  });

  describe('GET /summary/total-income', () => {
    it('should return total income for authenticated user', async () => {
      const response = await request(app)
        .get('/summary/total-income')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalIncome');
      // Should be 5000 + 2000 + 3000 = 10000
      expect(response.body.data.totalIncome).toBe(10000);
    });

    it('should allow viewer to access total income', async () => {
      // First create viewer's own records
      const viewerUser = await prisma.user.findUnique({
        where: { email: 'viewer-summary@test.com' }
      });

      await prisma.record.create({
        data: {
          amount: 1000,
          type: 'income',
          category: 'Gift',
          date: new Date('2025-04-15'),
          userId: viewerUser.id
        }
      });

      const response = await request(app)
        .get('/summary/total-income')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalIncome).toBe(1000); // Only viewer's records
    });
  });

  describe('GET /summary/total-expense', () => {
    it('should return total expense for authenticated user', async () => {
      const response = await request(app)
        .get('/summary/total-expense')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalExpense');
      // Should be 1500 + 800 + 1200 (March) = 3500
      expect(response.body.data.totalExpense).toBe(3500);
    });
  });

  describe('GET /summary/net-balance', () => {
    it('should return net balance with breakdown', async () => {
      const response = await request(app)
        .get('/summary/net-balance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('netBalance');
      expect(response.body.data).toHaveProperty('totalIncome');
      expect(response.body.data).toHaveProperty('totalExpense');

      // netBalance = 10000 (income) - 3500 (expense) = 6500
      expect(response.body.data.netBalance).toBe(6500);
      expect(response.body.data.totalIncome).toBe(10000);
      expect(response.body.data.totalExpense).toBe(3500);
    });
  });

  describe('GET /summary/category-wise', () => {
    it('should return category-wise totals sorted by amount', async () => {
      const response = await request(app)
        .get('/summary/category-wise')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Verify categories are present
      const categories = response.body.data.map(item => item.category);
      expect(categories).toContain('Salary');
      expect(categories).toContain('Food');
      expect(categories).toContain('Rent');

      // Verify sorting (highest amount first)
      for (let i = 1; i < response.body.data.length; i++) {
        expect(response.body.data[i - 1].totalAmount).toBeGreaterThanOrEqual(
          response.body.data[i].totalAmount
        );
      }
    });

    it('should group by both category and type', async () => {
      const response = await request(app)
        .get('/summary/category-wise')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const salaryIncome = response.body.data.find(
        item => item.category === 'Salary' && item.type === 'income'
      );
      expect(salaryIncome).toBeDefined();
      expect(salaryIncome.totalAmount).toBe(5000);
    });
  });

  describe('GET /summary/recent', () => {
    it('should return recent transactions with default limit 10', async () => {
      const response = await request(app)
        .get('/summary/recent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should respect custom limit parameter', async () => {
      const response = await request(app)
        .get('/summary/recent?limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(2);
    });

    it('should enforce max limit of 100', async () => {
      const response = await request(app)
        .get('/summary/recent?limit=200')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });

    it('should return records sorted by date descending', async () => {
      const response = await request(app)
        .get('/summary/recent?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dates = response.body.data.map(r => new Date(r.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });

  describe('GET /summary/monthly-trends', () => {
    it('should return monthly income vs expense trends', async () => {
      const response = await request(app)
        .get('/summary/monthly-trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // Verify structure
      const firstMonth = response.body.data[0];
      expect(firstMonth).toHaveProperty('month');
      expect(firstMonth).toHaveProperty('totalIncome');
      expect(firstMonth).toHaveProperty('totalExpense');

      // Verify sorting by month (YYYY-MM format can be compared lexicographically)
      for (let i = 1; i < response.body.data.length; i++) {
        const prevMonth = response.body.data[i - 1].month;
        const currMonth = response.body.data[i].month;
        expect(prevMonth <= currMonth).toBe(true); // Lexicographic comparison
      }
    });

    it('should correctly aggregate by month', async () => {
      const response = await request(app)
        .get('/summary/monthly-trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const trends = response.body.data;

      // Check March: 3000 income, 1200 expense
      const march = trends.find(t => t.month === '2025-03');
      expect(march).toBeDefined();
      expect(march.totalIncome).toBe(3000);
      expect(march.totalExpense).toBe(1200);

      // Check April: 7000 income (5000+2000), 2300 expense (1500+800)
      const april = trends.find(t => t.month === '2025-04');
      expect(april).toBeDefined();
      expect(april.totalIncome).toBe(7000);
      expect(april.totalExpense).toBe(2300);
    });
  });

  describe('Access Control for Summary Endpoints', () => {
    it('should allow viewer to access summary endpoints', async () => {
      const endpoints = [
        '/summary/total-income',
        '/summary/total-expense',
        '/summary/net-balance',
        '/summary/category-wise',
        '/summary/recent',
        '/summary/monthly-trends'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${viewerToken}`);

        expect(response.status).not.toBe(403);
        expect(response.body.success || response.status === 200).toBe(true);
      }
    });

    it('should deny unauthenticated access', async () => {
      const response = await request(app)
        .get('/summary/total-income')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/token/i);
    });
  });
});
