import dbConnect from '@/lib/mongodb';
import Transaction from '@/lib/models/Transaction';
import mongoose from 'mongoose';

/**
 * Transaction Service
 * Handles all transaction CRUD operations
 * Implements soft delete and filtering logic
 */

/**
 * Creates a new transaction
 * @param {object} transactionData - { amount, type, category, date, notes }
 * @param {string} userId - ID of the user creating the transaction
 * @returns {object} Created transaction
 */
export async function createTransaction(transactionData, userId) {
  await dbConnect();

  const transaction = await Transaction.create({
    ...transactionData,
    createdBy: userId,
    isDeleted: false
  });

  return {
    id: transaction._id.toString(),
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    date: transaction.date,
    notes: transaction.notes,
    createdBy: transaction.createdBy.toString(),
    isDeleted: transaction.isDeleted,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  };
}

/**
 * Retrieves all transactions with filters and pagination
 * Only returns non-deleted transactions
 * @param {object} filters - { type, category, startDate, endDate }
 * @param {object} pagination - { page, limit }
 * @returns {object} { transactions, total, page, limit, totalPages }
 */
export async function getAllTransactions(filters = {}, pagination = {}) {
  await dbConnect();

  const { type, category, startDate, endDate } = filters;
  const page = parseInt(pagination.page) || 1;
  const limit = parseInt(pagination.limit) || 10;
  const skip = (page - 1) * limit;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Build query - always exclude soft-deleted records
  const query = { isDeleted: false };

  // Apply type filter
  if (type && ['income', 'expense'].includes(type)) {
    query.type = type;
  }

  // Apply category filter (case-insensitive partial match)
  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }

  // Apply date range filters
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      // Set end date to end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.date.$lte = endOfDay;
    }

    // Never include future-dated transactions in default reporting views.
    if (!query.date.$lte || query.date.$lte > endOfToday) {
      query.date.$lte = endOfToday;
    }
  } else {
    query.date = { $lte: endOfToday };
  }

  // Execute query with pagination
  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('createdBy', 'name email')
      .select('-__v')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query)
  ]);

  // Transform response
  const transformedTransactions = transactions.map(transaction => ({
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
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  }));

  return {
    transactions: transformedTransactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Retrieves a single transaction by ID
 * @param {string} transactionId - MongoDB ObjectId string
 * @returns {object} Transaction data
 * @throws {Error} If transaction not found or deleted
 */
export async function getTransactionById(transactionId) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    const error = new Error('Invalid transaction ID format');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await Transaction.findOne({
    _id: transactionId,
    isDeleted: false
  })
    .populate('createdBy', 'name email')
    .select('-__v')
    .lean();

  if (!transaction) {
    const error = new Error('Transaction not found');
    error.statusCode = 404;
    throw error;
  }

  return {
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
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  };
}

/**
 * Updates a transaction (partial update supported)
 * Cannot change createdBy field
 * @param {string} transactionId - MongoDB ObjectId string
 * @param {object} updateData - Fields to update
 * @returns {object} Updated transaction
 * @throws {Error} If transaction not found
 */
export async function updateTransaction(transactionId, updateData) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    const error = new Error('Invalid transaction ID format');
    error.statusCode = 400;
    throw error;
  }

  // Remove createdBy if someone tries to change it
  delete updateData.createdBy;
  delete updateData.isDeleted; // Prevent un-deleting via update

  const transaction = await Transaction.findOneAndUpdate(
    { _id: transactionId, isDeleted: false },
    { ...updateData, updatedAt: new Date() },
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'name email')
    .select('-__v');

  if (!transaction) {
    const error = new Error('Transaction not found');
    error.statusCode = 404;
    throw error;
  }

  return {
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
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  };
}

/**
 * Soft deletes a transaction (sets isDeleted = true)
 * Does NOT remove from database - maintains audit trail
 * @param {string} transactionId - MongoDB ObjectId string
 * @returns {object} Deleted transaction summary
 * @throws {Error} If transaction not found
 */
export async function softDeleteTransaction(transactionId) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    const error = new Error('Invalid transaction ID format');
    error.statusCode = 400;
    throw error;
  }

  const transaction = await Transaction.findOneAndUpdate(
    { _id: transactionId, isDeleted: false },
    { isDeleted: true, updatedAt: new Date() },
    { new: true }
  ).select('_id amount type category date');

  if (!transaction) {
    const error = new Error('Transaction not found or already deleted');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: transaction._id.toString(),
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    date: transaction.date,
    deleted: true
  };
}
