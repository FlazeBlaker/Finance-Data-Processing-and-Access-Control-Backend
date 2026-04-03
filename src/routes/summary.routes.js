const router = require('express').Router();
const {
  getTotalIncome,
  getTotalExpense,
  getNetBalance,
  getCategoryWiseTotals,
  getRecentTransactions,
  getMonthlyTrends
} = require('../controllers/summary.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

/**
 * @route GET /total-income
 * @desc  Get total income for authenticated user
 * @access Private - Viewer, Analyst, and Admin
 */
router.get('/total-income', authenticate, authorizeRoles('viewer', 'analyst', 'admin'), getTotalIncome);

/**
 * @route GET /total-expense
 * @desc  Get total expense for authenticated user
 * @access Private - Viewer, Analyst, and Admin
 */
router.get('/total-expense', authenticate, authorizeRoles('viewer', 'analyst', 'admin'), getTotalExpense);

/**
 * @route GET /net-balance
 * @desc  Get net balance (income - expense) for authenticated user
 * @access Private - Viewer, Analyst, and Admin
 */
router.get('/net-balance', authenticate, authorizeRoles('viewer', 'analyst', 'admin'), getNetBalance);

/**
 * @route GET /category-wise
 * @desc  Get category-wise spending breakdown for authenticated user
 * @access Private - Viewer, Analyst, and Admin
 */
router.get('/category-wise', authenticate, authorizeRoles('viewer', 'analyst', 'admin'), getCategoryWiseTotals);

/**
 * @route GET /recent
 * @desc  Get recent transactions for authenticated user
 * @access Private - Viewer, Analyst, and Admin
 */
router.get('/recent', authenticate, authorizeRoles('viewer', 'analyst', 'admin'), getRecentTransactions);

/**
 * @route GET /monthly-trends
 * @desc  Get monthly income vs expense trends for authenticated user
 * @access Private - Viewer, Analyst, and Admin
 */
router.get('/monthly-trends', authenticate, authorizeRoles('viewer', 'analyst', 'admin'), getMonthlyTrends);

module.exports = router;
