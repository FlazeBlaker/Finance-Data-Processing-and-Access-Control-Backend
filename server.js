require('dotenv').config();

const express = require('express');
const app = express();

// Debug: confirm correct file is running
console.log("RUNNING FILE:", __filename);

// Middleware
app.use(express.json());

// Import rate limiting
const rateLimit = require('express-rate-limit');

// Rate limiting for auth endpoints to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const recordRoutes = require('./src/routes/record.routes');
const summaryRoutes = require('./src/routes/summary.routes');

// Mount routes with rate limiting on auth endpoints (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use('/auth', authLimiter, authRoutes);
} else {
  app.use('/auth', authRoutes);
}
app.use('/records', recordRoutes);
app.use('/summary', summaryRoutes);

// Import auth middleware
const { authenticate } = require('./src/middlewares/auth.middleware');

// Protected route (requires valid JWT token)
app.get('/protected', authenticate, (req, res) => {
  res.json({
    message: 'Access granted',
    user: req.user
  });
});

// Health check (ROOT)
app.get('/', (req, res) => {
  res.send('Finance Backend API');
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Export app for testing
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test: http://localhost:${PORT}`);
    console.log(`Register: POST http://localhost:${PORT}/auth/register`);
  });
}

module.exports = app;