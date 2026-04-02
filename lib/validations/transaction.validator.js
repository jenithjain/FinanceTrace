import { z } from 'zod';

/**
 * Transaction Validation Schemas
 * Zod schemas for validating financial transaction operations
 */

/**
 * Valid transaction types
 */
export const VALID_TRANSACTION_TYPES = ['income', 'expense'];

/**
 * Suggested categories for transactions
 * Note: These are suggestions, any valid string is accepted
 */
export const SUGGESTED_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Food',
  'Rent',
  'Utilities',
  'Healthcare',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Education',
  'Other'
];

function parseTransactionDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  return new Date(value);
}

function isFutureDate(date) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date > endOfToday;
}

/**
 * Schema for creating a new transaction
 * Used in: POST /api/finance/transactions
 */
export const createTransactionSchema = z.object({
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number'
    })
    .positive('Amount must be greater than 0')
    .max(999999999.99, 'Amount is too large'),
  
  type: z
    .string({
      required_error: 'Transaction type is required',
      invalid_type_error: 'Type must be a string'
    })
    .refine(
      (val) => VALID_TRANSACTION_TYPES.includes(val),
      {
        message: `Type must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}`
      }
    ),
  
  category: z
    .string({
      required_error: 'Category is required',
      invalid_type_error: 'Category must be a string'
    })
    .min(2, 'Category must be at least 2 characters')
    .max(50, 'Category must be less than 50 characters')
    .trim(),
  
  date: z
    .string({
      required_error: 'Date is required'
    })
    .datetime({ message: 'Invalid date format. Use ISO 8601 format.' })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'))
    .transform((val) => parseTransactionDate(val))
    .refine((date) => !Number.isNaN(date.getTime()), 'Invalid date value')
    .refine((date) => !isFutureDate(date), 'Date cannot be in the future'),
  
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .trim()
    .optional()
    .nullable()
});

/**
 * Schema for updating an existing transaction
 * All fields are optional - partial update supported
 * Used in: PATCH /api/finance/transactions/[id]
 */
export const updateTransactionSchema = createTransactionSchema.partial();

/**
 * Schema for transaction query filters
 * Used in: GET /api/finance/transactions
 */
export const transactionQuerySchema = z.object({
  type: z
    .string()
    .refine(
      (val) => VALID_TRANSACTION_TYPES.includes(val),
      { message: `Type must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}` }
    )
    .optional(),
  
  category: z
    .string()
    .min(1)
    .optional(),
  
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional(),
  
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional(),
  
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, 'Page must be a positive number')
    .optional()
    .default('1'),
  
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('10')
});

/**
 * Helper function to format Zod validation errors
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {object} Formatted field errors
 */
export function formatZodErrors(zodError) {
  return zodError.flatten().fieldErrors;
}
