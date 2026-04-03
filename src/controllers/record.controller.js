const prisma = require('../utils/prisma');

/**
 * @desc    Create a new financial record (income/expense)
 * @route   POST /records
 * @access  Private (Admin only)
 */
exports.createRecord = async (req, res, next) => {
  try {
    // Get user ID from authenticated user (set by auth middleware)
    const userId = req.user.userId;

    // Extract fields from request body
    const { amount, type, category, date, note } = req.body;

    // 1. Validate required fields
    if (!amount || !type || !category || !date) {
      return res.status(400).json({
        success: false,
        error: 'Amount, type, category, and date are required'
      });
    }

    // 2. Validate amount is a positive number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // 3. Validate type is either 'income' or 'expense'
    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"'
      });
    }

    // 4. Validate category is not empty
    if (!category || category.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    // 5. Validate date format (expecting ISO string or date string)
    let recordDate;
    try {
      recordDate = new Date(date);
      if (isNaN(recordDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO date string (e.g., "2025-04-01")'
      });
    }

    // 6. Create record in database
    const record = await prisma.record.create({
      data: {
        amount: parsedAmount,
        type,
        category: category.trim(),
        date: recordDate,
        note: note ? note.trim() : null,
        userId
      }
    });

    // 7. Return created record (201 Created)
    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Create record error:', error);
    next(error);
  }
};

/**
 * @desc    Get all records for authenticated user with optional filters
 * @route   GET /records
 * @access  Private (Authenticated users)
 * @query   {type, category, startDate, endDate} - optional filters
 */
exports.getRecords = async (req, res, next) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user.userId;

    // Extract filter query parameters
    const { type, category, startDate, endDate } = req.query;

    // Build dynamic where clause
    const where = { userId };

    // Filter by type (only 'income' or 'expense' are valid)
    if (type) {
      if (type === 'income' || type === 'expense') {
        where.type = type;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid type filter. Must be "income" or "expense"'
        });
      }
    }

    // Filter by category (partial match, case-insensitive)
    if (category) {
      where.category = {
        contains: String(category),
        mode: 'insensitive'
      };
    }

    // Filter by date range
    if (startDate || endDate) {
      where.date = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid startDate format. Use ISO date string (e.g., "2025-04-01")'
          });
        }
        where.date.gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid endDate format. Use ISO date string (e.g., "2025-04-30")'
          });
        }
        where.date.lte = end;
      }
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination. page and limit must be positive numbers. limit max 100.'
      });
    }

    // Fetch records with dynamic where clause and pagination
    const [records, totalCount] = await Promise.all([
      prisma.record.findMany({
        where,
        orderBy: {
          date: 'desc' // Most recent first
        },
        skip,
        take: limit
      }),
      prisma.record.count({
        where
      })
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    // Return records array with pagination info
    res.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        totalRecords: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Get records error:', error);
    next(error);
  }
};

/**
 * @desc    Update a financial record by ID
 * @route   PUT /records/:id
 * @access  Private (Admin only)
 */
exports.updateRecord = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const id = parseInt(req.params.id);

    // Validate ID is a valid number
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid record ID'
      });
    }

    // Verify record exists and belongs to the authenticated user
    const existingRecord = await prisma.record.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: 'Record not found or you do not have permission to update it'
      });
    }

    // Extract fields from request body
    const { amount, type, category, date, note } = req.body;

    // Validate required fields
    if (!amount || !type || !category || !date) {
      return res.status(400).json({
        success: false,
        error: 'Amount, type, category, and date are required'
      });
    }

    // Validate amount is a positive number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Validate type is either 'income' or 'expense'
    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({
        success: false,
        error: 'Type must be either "income" or "expense"'
      });
    }

    // Validate category is not empty
    if (!category || category.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Category is required'
      });
    }

    // Validate date format (expecting ISO string or date string)
    let recordDate;
    try {
      recordDate = new Date(date);
      if (isNaN(recordDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use ISO date string (e.g., "2025-04-01")'
      });
    }

    // Prepare update data
    const updateData = {
      amount: parsedAmount,
      type,
      category: category.trim(),
      date: recordDate
    };

    // Include note if provided
    if (note !== undefined) {
      updateData.note = note.trim() || null;
    }

    // Update record
    const updatedRecord = await prisma.record.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updatedRecord
    });
  } catch (error) {
    console.error('Update record error:', error);
    next(error);
  }
};

/**
 * @desc    Delete a financial record by ID (admin only, ownership check)
 * @route   DELETE /records/:id
 * @access  Private - Admin only
 */
exports.deleteRecord = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const recordId = parseInt(req.params.id);

    // Validate ID is a valid number
    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid record ID'
      });
    }

    // 1. Check if record exists and belongs to the user
    const existingRecord = await prisma.record.findUnique({
      where: { id: recordId }
    });

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    // 2. Verify ownership
    if (existingRecord.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only delete your own records'
      });
    }

    // 3. Delete the record
    await prisma.record.delete({
      where: { id: recordId }
    });

    // 4. Return success response
    res.json({
      success: true,
      message: 'Record deleted successfully'
    });
  } catch (error) {
    console.error('Delete record error:', error);
    next(error);
  }
};
