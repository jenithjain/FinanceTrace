import mongoose from 'mongoose';

/**
 * Transaction Schema
 * Represents financial records (income/expense) in the finance dashboard
 * Supports soft delete for audit trail
 */
const TransactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  type: {
    type: String,
    enum: {
      values: ['income', 'expense'],
      message: 'Type must be either income or expense'
    },
    required: [true, 'Transaction type is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    minlength: [2, 'Category must be at least 2 characters']
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator reference is required']
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
TransactionSchema.index({ createdBy: 1, date: -1 });
TransactionSchema.index({ type: 1, category: 1 });
TransactionSchema.index({ isDeleted: 1 });

// Exclude __v from JSON output
TransactionSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

// Prevent model recompilation in development
export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
