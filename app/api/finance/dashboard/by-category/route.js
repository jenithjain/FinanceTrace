import { getByCategory } from '@/lib/services/dashboard.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

/**
 * GET /api/finance/dashboard/by-category
 * Returns transaction totals grouped by category
 * Accessible by: All authenticated users (Viewer, Analyst, Admin)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Category breakdown retrieved successfully",
 *   "data": {
 *     "categories": [
 *       { "category": "Salary", "type": "income", "total": 120000, "count": 12 },
 *       { "category": "Food", "type": "expense", "total": 15000, "count": 30 }
 *     ]
 *   }
 * }
 */
async function handleGetByCategory(request) {
  try {
    const categories = await getByCategory();

    return successResponse(
      'Category breakdown retrieved successfully',
      { categories },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get by category error:', error);

    return errorResponse(
      'Failed to retrieve category breakdown',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with all roles allowed
export const GET = withAuth(handleGetByCategory, ['viewer', 'analyst', 'admin']);
