import { getAllUsers } from '@/lib/services/user.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

/**
 * GET /api/finance/users
 * Returns all users in the system (Admin only)
 * 
 * Query Parameters:
 * - status: 'active' | 'inactive' (optional filter)
 * - roleRequestStatus: 'none' | 'pending' | 'approved' | 'rejected' (optional filter)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Users retrieved successfully",
 *   "data": { "users": [...], "total": 10 }
 * }
 */
async function handleGetUsers(request) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const roleRequestStatus = searchParams.get('roleRequestStatus');

    // Build filters
    const filters = {};
    if (status) {
      filters.status = status;
    }
    if (roleRequestStatus) {
      filters.roleRequestStatus = roleRequestStatus;
    }

    // Get users from service
    const users = await getAllUsers(filters);

    return successResponse(
      'Users retrieved successfully',
      { 
        users,
        total: users.length
      },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get users error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to retrieve users',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with admin-only protection
export const GET = withAuth(handleGetUsers, ['admin']);
