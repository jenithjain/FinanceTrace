import { getTrends } from '@/lib/services/dashboard.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

/**
 * GET /api/finance/dashboard/trends
 * Returns monthly income/expense trends for the current year
 * Accessible by: All authenticated users (Viewer, Analyst, Admin)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Monthly trends retrieved successfully",
 *   "data": {
 *     "year": 2024,
 *     "trends": [
 *       { "month": 1, "monthName": "January", "income": 30000, "expense": 15000, "net": 15000 },
 *       { "month": 2, "monthName": "February", "income": 28000, "expense": 12000, "net": 16000 }
 *     ]
 *   }
 * }
 */
async function handleGetTrends(request) {
  try {
    const trends = await getTrends();
    const currentYear = new Date().getFullYear();

    return successResponse(
      'Monthly trends retrieved successfully',
      { 
        year: currentYear,
        trends 
      },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get trends error:', error);

    return errorResponse(
      'Failed to retrieve trends',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with all roles allowed
export const GET = withAuth(handleGetTrends, ['viewer', 'analyst', 'admin']);
