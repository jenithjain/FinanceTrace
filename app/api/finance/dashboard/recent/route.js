import { getRecent } from '@/lib/services/dashboard.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

/**
 * GET /api/finance/dashboard/recent
 * Returns the most recent transactions
 * Accessible by: All authenticated users (Viewer, Analyst, Admin)
 * 
 * Query Parameters:
 * - limit: number (default: 10, max: 50)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Recent transactions retrieved successfully",
 *   "data": {
 *     "transactions": [
 *       {
 *         "id": "...",
 *         "amount": 5000,
 *         "type": "income",
 *         "category": "Salary",
 *         "date": "2024-01-15",
 *         "createdBy": { "id": "...", "name": "John", "email": "john@example.com" }
 *       }
 *     ]
 *   }
 * }
 */
async function handleGetRecent(request) {
  try {
    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit')) || 10;
    
    // Enforce max limit of 50
    limit = Math.min(Math.max(limit, 1), 50);

    const transactions = await getRecent(limit);

    return successResponse(
      'Recent transactions retrieved successfully',
      { transactions },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get recent error:', error);

    return errorResponse(
      'Failed to retrieve recent transactions',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with all roles allowed
export const GET = withAuth(handleGetRecent, ['viewer', 'analyst', 'admin']);
