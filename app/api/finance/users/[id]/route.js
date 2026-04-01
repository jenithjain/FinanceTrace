import { getUserById, deleteUser } from '@/lib/services/user.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

/**
 * GET /api/finance/users/[id]
 * Returns a single user by ID (Admin only)
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "User retrieved successfully",
 *   "data": { "user": {...} }
 * }
 */
async function handleGetUser(request, { params }) {
  try {
    const { id } = await params;
    
    const user = await getUserById(id);

    return successResponse(
      'User retrieved successfully',
      { user },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Get user error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to retrieve user',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

/**
 * DELETE /api/finance/users/[id]
 * Deletes a user permanently (Admin only)
 * Note: Cannot delete yourself
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "User deleted successfully",
 *   "data": { "deletedUser": {...} }
 * }
 */
async function handleDeleteUser(request, { params }) {
  try {
    const { id } = await params;
    const requestingUserId = request.user.id;

    const deletedUser = await deleteUser(id, requestingUserId);

    return successResponse(
      'User deleted successfully',
      { deletedUser },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Delete user error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to delete user',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with admin-only protection
export const GET = withAuth(handleGetUser, ['admin']);
export const DELETE = withAuth(handleDeleteUser, ['admin']);
