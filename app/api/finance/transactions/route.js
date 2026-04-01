import { createTransaction, getAllTransactions } from '@/lib/services/transaction.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { 
  createTransactionSchema, 
  transactionQuerySchema,
  formatZodErrors 
} from '@/lib/validations/transaction.validator';

/**
 * GET /api/finance/transactions
 * Returns all transactions with optional filters and pagination
 * Accessible by: Analyst, Admin
 * 
 * Query Parameters:
 * - type: 'income' | 'expense'
 * - category: string (partial match)
 * - startDate: 'YYYY-MM-DD'
 * - endDate: 'YYYY-MM-DD'
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Transactions retrieved successfully",
 *   "data": {
 *     "transactions": [...],
 *     "total": 45,
 *     "page": 1,
 *     "limit": 10,
 *     "totalPages": 5
 *   }
 * }
 */
async function handleGetTransactions(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query params
    const queryParams = {
      type: searchParams.get('type') || undefined,
      category: searchParams.get('category') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10'
    };

    // Validate query params
    const validationResult = transactionQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return errorResponse(
        'Invalid query parameters',
        HTTP_STATUS.BAD_REQUEST,
        formatZodErrors(validationResult.error)
      );
    }

    const { type, category, startDate, endDate, page, limit } = validationResult.data;

    // Get transactions
    const result = await getAllTransactions(
      { type, category, startDate, endDate },
      { page, limit }
    );

    return successResponse(
      'Transactions retrieved successfully',
      result,
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get transactions error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to retrieve transactions',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

/**
 * POST /api/finance/transactions
 * Creates a new transaction
 * Accessible by: Admin only
 * 
 * Request Body:
 * {
 *   "amount": 5000,
 *   "type": "income",
 *   "category": "Salary",
 *   "date": "2024-01-15",
 *   "notes": "January salary" (optional)
 * }
 */
async function handleCreateTransaction(request) {
  try {
    const body = await request.json();

    // Validate input
    const validationResult = createTransactionSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        formatZodErrors(validationResult.error)
      );
    }

    // Create transaction with logged-in user as creator
    const transaction = await createTransaction(
      validationResult.data,
      request.user.id
    );

    return successResponse(
      'Transaction created successfully',
      { transaction },
      HTTP_STATUS.CREATED
    );

  } catch (error) {
    console.error('Create transaction error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to create transaction',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with role-based protection
export const GET = withAuth(handleGetTransactions, ['analyst', 'admin']);
export const POST = withAuth(handleCreateTransaction, ['admin']);
