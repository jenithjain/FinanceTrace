import { 
  getTransactionById, 
  updateTransaction, 
  softDeleteTransaction 
} from '@/lib/services/transaction.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { updateTransactionSchema, formatZodErrors } from '@/lib/validations/transaction.validator';

/**
 * GET /api/finance/transactions/[id]
 * Returns a single transaction by ID
 * Accessible by: Analyst, Admin
 */
async function handleGetTransaction(request, { params }) {
  try {
    const { id } = await params;

    const transaction = await getTransactionById(id);

    return successResponse(
      'Transaction retrieved successfully',
      { transaction },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get transaction error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to retrieve transaction',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

/**
 * PATCH /api/finance/transactions/[id]
 * Updates a transaction (partial update supported)
 * Accessible by: Admin only
 * 
 * Request Body (all fields optional):
 * {
 *   "amount": 6000,
 *   "type": "income",
 *   "category": "Bonus",
 *   "date": "2024-01-20",
 *   "notes": "Updated notes"
 * }
 */
async function handleUpdateTransaction(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input (partial - all fields optional)
    const validationResult = updateTransactionSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        formatZodErrors(validationResult.error)
      );
    }

    // Check if there's anything to update
    if (Object.keys(validationResult.data).length === 0) {
      return errorResponse(
        'No fields provided for update',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const transaction = await updateTransaction(id, validationResult.data);

    return successResponse(
      'Transaction updated successfully',
      { transaction },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Update transaction error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to update transaction',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

/**
 * DELETE /api/finance/transactions/[id]
 * Soft deletes a transaction (sets isDeleted = true)
 * Accessible by: Admin only
 * 
 * Note: This is a SOFT DELETE - record remains in database for audit trail
 */
async function handleDeleteTransaction(request, { params }) {
  try {
    const { id } = await params;

    const deletedTransaction = await softDeleteTransaction(id);

    return successResponse(
      'Transaction deleted successfully',
      { deletedTransaction },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Delete transaction error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to delete transaction',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with role-based protection
export const GET = withAuth(handleGetTransaction, ['analyst', 'admin']);
export const PATCH = withAuth(handleUpdateTransaction, ['admin']);
export const DELETE = withAuth(handleDeleteTransaction, ['admin']);
