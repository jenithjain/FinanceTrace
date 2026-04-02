import dbConnect from '@/lib/mongodb';
import Transaction from '@/lib/models/Transaction';

/**
 * Dashboard Service
 * Provides aggregated financial data for dashboard display
 * ALL calculations done via MongoDB Aggregation Pipeline (not JS)
 */

function toStartOfDay(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function getDateMatch(range = {}) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const startDate = range.startDate ? toStartOfDay(range.startDate) : null;
  const requestedEnd = range.endDate ? toEndOfDay(range.endDate) : null;
  const endDate = requestedEnd && requestedEnd < endOfToday ? requestedEnd : endOfToday;

  if (startDate && startDate > endDate) {
    const error = new Error('Invalid date range: startDate cannot be after endDate');
    error.statusCode = 400;
    throw error;
  }

  const match = { $lte: endDate };
  if (startDate) {
    match.$gte = startDate;
  }

  return { match, endDate };
}

function getMonthSeriesStart(range = {}, endDate) {
  if (range.startDate) {
    const explicitStart = toStartOfDay(range.startDate);
    if (explicitStart) {
      return new Date(explicitStart.getFullYear(), explicitStart.getMonth(), 1);
    }
  }

  return new Date(endDate.getFullYear(), 0, 1);
}

function buildMonthlySeries(startDate, endDate, aggregatedMap) {
  const series = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= endMonth) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthLabel = cursor.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const current = aggregatedMap.get(monthKey) || { income: 0, expense: 0 };

    series.push({
      month,
      year,
      monthKey,
      monthName: monthLabel,
      income: Math.round(current.income * 100) / 100,
      expense: Math.round(current.expense * 100) / 100,
      net: Math.round((current.income - current.expense) * 100) / 100,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return series;
}

/**
 * Get financial summary totals
 * Returns: totalIncome, totalExpenses, netBalance, totalTransactions
 * @returns {object} Summary statistics
 */
export async function getSummary(range = {}) {
  await dbConnect();
  const { match: dateMatch } = getDateMatch(range);

  const result = await Transaction.aggregate([
    // Stage 1: Filter out deleted transactions
    { $match: { isDeleted: false, date: dateMatch } },
    
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
export async function getByCategory(range = {}) {
  await dbConnect();
  const { match: dateMatch } = getDateMatch(range);

  const result = await Transaction.aggregate([
    // Stage 1: Filter out deleted transactions
    { $match: { isDeleted: false, date: dateMatch } },
    
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
export async function getTrends(range = {}) {
  await dbConnect();
  const { match: dateMatch, endDate } = getDateMatch(range);
  const startDate = getMonthSeriesStart(range, endDate);

  const result = await Transaction.aggregate([
    // Stage 1: Filter by selected range and ignore soft deleted rows
    {
      $match: {
        isDeleted: false,
        date: dateMatch
      }
    },
    
    // Stage 2: Group by month and type
    {
      $group: {
        _id: {
          yearMonth: { $dateToString: { format: '%Y-%m', date: '$date' } },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    },
    
    // Stage 3: Reshape to pivot income/expense into columns
    {
      $group: {
        _id: '$_id.yearMonth',
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
        monthKey: '$_id',
        income: { $round: ['$income', 2] },
        expense: { $round: ['$expense', 2] },
        net: {
          $round: [{ $subtract: ['$income', '$expense'] }, 2]
        }
      }
    },
    
    // Stage 5: Sort by month key
    { $sort: { monthKey: 1 } }
  ]);

  const aggregatedMap = new Map(
    result.map((entry) => [entry.monthKey, { income: entry.income || 0, expense: entry.expense || 0 }])
  );

  return buildMonthlySeries(startDate, endDate, aggregatedMap);
}

/**
 * Get recent transactions
 * Returns last N transactions sorted by date descending
 * @param {number} limit - Number of transactions to return (default: 10)
 * @returns {array} Recent transactions with creator info
 */
export async function getRecent(limit = 10, range = {}) {
  await dbConnect();
  const { match: dateMatch } = getDateMatch(range);

  const transactions = await Transaction.find({ isDeleted: false, date: dateMatch })
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
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const result = await Transaction.aggregate([
    { $match: { isDeleted: false, date: { $lte: endOfToday } } },
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
