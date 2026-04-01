import { updateUserRole } from '@/lib/services/user.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { updateRoleSchema, formatZodErrors } from '@/lib/validations/user.validator';

/**
 * PATCH /api/finance/users/[id]/role
 * Updates a user's role (Admin only)
 * 
 * Request Body:
 * {
 *   "role": "analyst" // viewer | analyst | admin
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "User role updated successfully",
 *   "data": { "user": {...} }
 * }
 */
async function handleUpdateRole(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = updateRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        formatZodErrors(validationResult.error)
      );
    }

    const { role } = validationResult.data;

    // Update user role
    const user = await updateUserRole(id, role);

    return successResponse(
      `User role updated to '${role}' successfully`,
      { user },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Update role error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to update user role',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

// Export with admin-only protection
export const PATCH = withAuth(handleUpdateRole, ['admin']);
