const router = require('express').Router();
const { createRecord, getRecords, deleteRecord, updateRecord } = require('../controllers/record.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

/**
 * @route GET /records
 * @desc  Get all financial records for authenticated user
 * @access Private - Authenticated users only
 */
router.get('/', authenticate, getRecords);

/**
 * @route POST /records
 * @desc  Create a new financial record (income/expense)
 * @access Private - Admin only
 */
router.post(
  '/',
  authenticate,
  authorizeRoles('admin'),
  createRecord
);

/**
 * @route PUT /records/:id
 * @desc  Update a financial record by ID
 * @access Private - Admin only
 */
router.put('/:id', authenticate, authorizeRoles('admin'), updateRecord);

/**
 * @route DELETE /records/:id
 * @desc  Delete a financial record by ID (admin only, ownership check)
 * @access Private - Admin only
 */
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteRecord);

module.exports = router;
