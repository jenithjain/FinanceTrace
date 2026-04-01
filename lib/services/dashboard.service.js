import dbConnect from '@/lib/mongodb';
import Transaction from '@/lib/models/Transaction';

/**
 * Dashboard Service
 * Provides aggregated financial data for dashboard display
 * ALL calculations done via MongoDB Aggregation Pipeline (not JS)
 */

/**
 * Get financial summary totals
 * Returns: totalIncome, totalExpenses, netBalance, totalTransactions
 * @returns {object} Summary statistics
 */
export async function getSummary() {
  await dbConnect();

  const result = await Transaction.aggregate([
    // Stage 1: Filter out deleted transactions
    { $match: { isDeleted: false } },
    
    // Stage 2: Group and calculate totals
    {
      $group: {
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
          }
        },
        totalExpenses: {
          $sum: {
            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
          }
        },
        totalTransactions: { $sum: 1 }
      }
    },
    
    // Stage 3: Calculate net balance and clean up output
    {
      $project: {
        _id: 0,
        totalIncome: { $round: ['$totalIncome', 2] },
        totalExpenses: { $round: ['$totalExpenses', 2] },
        netBalance: {
          $round: [{ $subtract: ['$totalIncome', '$totalExpenses'] }, 2]
        },
        totalTransactions: 1
      }
    }
  ]);

  // Return default values if no transactions exist
  return result[0] || {
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    totalTransactions: 0
  };
}

/**
 * Get totals grouped by category
 * Returns array sorted by total amount descending
 * @returns {array} [{ category, total, count, type }]
 */
export async function getByCategory() {
  await dbConnect();

  const result = await Transaction.aggregate([
    // Stage 1: Filter out deleted transactions
    { $match: { isDeleted: false } },
    
    // Stage 2: Group by category and type
    {
      $group: {
        _id: { category: '$category', type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    
    // Stage 3: Reshape output
    {
      $project: {
        _id: 0,
        category: '$_id.category',
        type: '$_id.type',
        total: { $round: ['$total', 2] },
        count: 1
      }
    },
    
    // Stage 4: Sort by total descending
    { $sort: { total: -1 } }
  ]);

  return result;
}

/**
 * Get monthly income/expense trends for the current year
 * Returns monthly breakdown with income and expense totals
 * @returns {array} [{ month, monthName, income, expense, net }]
 */
export async function getTrends() {
  await dbConnect();

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1); // January 1st
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const result = await Transaction.aggregate([
    // Stage 1: Filter - current year only, not deleted
    {
      $match: {
        isDeleted: false,
        date: { $gte: startOfYear, $lte: endOfYear }
      }
    },
    
    // Stage 2: Group by month and type
    {
      $group: {
        _id: {
          month: { $month: '$date' },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    },
    
    // Stage 3: Reshape to pivot income/expense into columns
    {
      $group: {
        _id: '$_id.month',
        income: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
          }
        },
        expense: {
          $sum: {
            $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
          }
        }
      }
    },
    
    // Stage 4: Calculate net and format output
    {
      $project: {
        _id: 0,
        month: '$_id',
        income: { $round: ['$income', 2] },
        expense: { $round: ['$expense', 2] },
        net: {
          $round: [{ $subtract: ['$income', '$expense'] }, 2]
        }
      }
    },
    
    // Stage 5: Sort by month
    { $sort: { month: 1 } }
  ]);

  // Fill in missing months with zeros and add month names
  const monthlyData = monthNames.map((monthName, index) => {
    const monthNumber = index + 1;
    const existingData = result.find(r => r.month === monthNumber);
    
    return {
      month: monthNumber,
      monthName,
      income: existingData?.income || 0,
      expense: existingData?.expense || 0,
      net: existingData?.net || 0
    };
  });

  return monthlyData;
}

/**
 * Get recent transactions
 * Returns last N transactions sorted by date descending
 * @param {number} limit - Number of transactions to return (default: 10)
 * @returns {array} Recent transactions with creator info
 */
export async function getRecent(limit = 10) {
  await dbConnect();

  const transactions = await Transaction.find({ isDeleted: false })
    .populate('createdBy', 'name email')
    .select('-__v -isDeleted')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return transactions.map(transaction => ({
    id: transaction._id.toString(),
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    date: transaction.date,
    notes: transaction.notes,
    createdBy: transaction.createdBy ? {
      id: transaction.createdBy._id.toString(),
      name: transaction.createdBy.name,
      email: transaction.createdBy.email
    } : null,
    createdAt: transaction.createdAt
  }));
}

/**
 * Get income vs expense comparison
 * Useful for pie charts or comparison widgets
 * @returns {object} { income: { total, percentage }, expense: { total, percentage } }
 */
export async function getIncomeVsExpense() {
  await dbConnect();

  const result = await Transaction.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const income = result.find(r => r._id === 'income')?.total || 0;
  const expense = result.find(r => r._id === 'expense')?.total || 0;
  const grandTotal = income + expense;

  return {
    income: {
      total: Math.round(income * 100) / 100,
      percentage: grandTotal > 0 ? Math.round((income / grandTotal) * 100) : 0
    },
    expense: {
      total: Math.round(expense * 100) / 100,
      percentage: grandTotal > 0 ? Math.round((expense / grandTotal) * 100) : 0
    },
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}
