const prisma = require('../utils/prisma');

/**
 * @desc    Get total income for authenticated user
 * @route   GET /summary/income
 * @access  Private (Authenticated users)
 */
exports.getTotalIncome = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await prisma.record.aggregate({
      where: {
        userId,
        type: 'income'
      },
      _sum: {
        amount: true
      }
    });

    const totalIncome = result._sum.amount || 0;

    res.json({
      success: true,
      data: {
        totalIncome
      }
    });
  } catch (error) {
    console.error('Get total income error:', error);
    next(error);
  }
};

/**
 * @desc    Get total expense for authenticated user
 * @route   GET /summary/expense
 * @access  Private (Authenticated users)
 */
exports.getTotalExpense = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await prisma.record.aggregate({
      where: {
        userId,
        type: 'expense'
      },
      _sum: {
        amount: true
      }
    });

    const totalExpense = result._sum.amount || 0;

    res.json({
      success: true,
      data: {
        totalExpense
      }
    });
  } catch (error) {
    console.error('Get total expense error:', error);
    next(error);
  }
};

/**
 * @desc    Get net balance (income - expense) for authenticated user
 * @route   GET /summary/balance
 * @access  Private (Authenticated users)
 */
exports.getNetBalance = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await prisma.record.groupBy({
      by: ['type'],
      where: {
        userId
      },
      _sum: {
        amount: true
      }
    });

    let totalIncome = 0;
    let totalExpense = 0;

    result.forEach(item => {
      if (item.type === 'income') {
        totalIncome = item._sum.amount || 0;
      } else if (item.type === 'expense') {
        totalExpense = item._sum.amount || 0;
      }
    });

    const netBalance = totalIncome - totalExpense;

    res.json({
      success: true,
      data: {
        netBalance,
        totalIncome,
        totalExpense
      }
    });
  } catch (error) {
    console.error('Get net balance error:', error);
    next(error);
  }
};

/**
 * @desc    Get category-wise totals for authenticated user
 * @route   GET /summary/categories
 * @access  Private (Authenticated users)
 */
exports.getCategoryWiseTotals = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const results = await prisma.record.groupBy({
      by: ['category', 'type'],
      where: {
        userId
      },
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });

    const categoryTotals = results.map(item => ({
      category: item.category,
      type: item.type,
      totalAmount: item._sum.amount || 0
    }));

    res.json({
      success: true,
      data: categoryTotals
    });
  } catch (error) {
    console.error('Get category-wise totals error:', error);
    next(error);
  }
};

/**
 * @desc    Get recent transactions for authenticated user
 * @route   GET /summary/recent
 * @access  Private (Authenticated users)
 */
exports.getRecentTransactions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Max 100

    const transactions = await prisma.record.findMany({
      where: {
        userId
      },
      orderBy: {
        date: 'desc'
      },
      take: limit
    });

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Get recent transactions error:', error);
    next(error);
  }
};

/**
 * @desc    Get monthly trends (income vs expense) for authenticated user
 * @route   GET /summary/trends
 * @access  Private (Authenticated users)
 */
exports.getMonthlyTrends = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Fetch all records and process grouping in JavaScript to handle SQLite limitations
    const records = await prisma.record.findMany({
      where: {
        userId
      },
      select: {
        amount: true,
        type: true,
        date: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Group by year-month
    const monthlyData = {};

    records.forEach(record => {
      const date = new Date(record.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          totalIncome: 0,
          totalExpense: 0
        };
      }

      if (record.type === 'income') {
        monthlyData[monthKey].totalIncome += record.amount;
      } else if (record.type === 'expense') {
        monthlyData[monthKey].totalExpense += record.amount;
      }
    });

    // Convert to array and sort by month
    const trends = Object.values(monthlyData).sort((a, b) => {
      return a.month.localeCompare(b.month);
    });

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Get monthly trends error:', error);
    next(error);
  }
};
