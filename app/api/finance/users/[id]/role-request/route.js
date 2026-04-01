import { resolveUserRoleRequest } from '@/lib/services/user.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { z } from 'zod';

const resolveRoleRequestSchema = z.object({
  action: z.enum(['approve', 'reject'])
});

/**
 * PATCH /api/finance/users/[id]/role-request
 * Resolve a pending role request (Admin only)
 *
 * Request Body:
 * {
 *   "action": "approve" // approve | reject
 * }
 */
async function handleResolveRoleRequest(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validationResult = resolveRoleRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        validationResult.error.flatten().fieldErrors
      );
    }

    const { action } = validationResult.data;

    const user = await resolveUserRoleRequest(id, action);

    return successResponse(
      action === 'approve'
        ? 'Role request approved successfully'
        : 'Role request rejected successfully',
      { user },
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('Resolve role request error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to resolve role request',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

export const PATCH = withAuth(handleResolveRoleRequest, ['admin']);
