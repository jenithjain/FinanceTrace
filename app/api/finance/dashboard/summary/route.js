import { getSummary } from '@/lib/services/dashboard.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

/**
 * GET /api/finance/dashboard/summary
 * Returns financial summary totals
 * Accessible by: All authenticated users (Viewer, Analyst, Admin)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Summary retrieved successfully",
 *   "data": {
 *     "totalIncome": 150000,
 *     "totalExpenses": 80000,
 *     "netBalance": 70000,
 *     "totalTransactions": 45
 *   }
 * }
 */
async function handleGetSummary(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const summary = await getSummary({ startDate, endDate });

    return successResponse(
      'Summary retrieved successfully',
      summary,
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get summary error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to retrieve summary',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with all roles allowed
export const GET = withAuth(handleGetSummary, ['viewer', 'analyst', 'admin']);
