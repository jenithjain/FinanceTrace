import { updateUserStatus } from '@/lib/services/user.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { updateStatusSchema, formatZodErrors } from '@/lib/validations/user.validator';

/**
 * PATCH /api/finance/users/[id]/status
 * Updates a user's status (Admin only)
 * 
 * Request Body:
 * {
 *   "status": "inactive" // active | inactive
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "User status updated successfully",
 *   "data": { "user": {...} }
 * }
 */
async function handleUpdateStatus(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = updateStatusSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        formatZodErrors(validationResult.error)
      );
    }

    const { status } = validationResult.data;

    // Update user status
    const user = await updateUserStatus(id, status);

    return successResponse(
      `User status updated to '${status}' successfully`,
      { user },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Update status error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to update user status',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with admin-only protection
export const PATCH = withAuth(handleUpdateStatus, ['admin']);
