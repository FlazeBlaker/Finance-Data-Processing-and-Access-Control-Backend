const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

/**
 * @desc    Register a new user
 * @route   POST /auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    // 2. Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // 3. Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // 4. Validate role (only specific roles allowed)
    const allowedRoles = ['viewer', 'analyst', 'admin'];
    const userRole = role || 'viewer'; // Default to viewer

    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`
      });
    }

    // 5. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // 6. Hash password (bcrypt with 10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        isActive: true
      },
      // Exclude password from response
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // 8. Return success response
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle Prisma unique constraint error (should be caught earlier, but just in case)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Pass other errors to global error handler
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // 2. Find user by email (including password for comparison)
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // 3. Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 4. Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 6. Return token and user data (exclude password)
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    // JWT secret missing or invalid
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(500).json({
        success: false,
        error: 'Authentication configuration error'
      });
    }

    // Pass other errors to global error handler
    next(error);
  }
};

module.exports = {
  register: exports.register,
  login: exports.login
};
