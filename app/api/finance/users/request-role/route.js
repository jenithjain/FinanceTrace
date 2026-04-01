import { submitUserRoleRequest } from '@/lib/services/user.service';
import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { z } from 'zod';

const requestRoleSchema = z.object({
  requestedRole: z.enum(['viewer', 'analyst', 'admin'])
});

/**
 * PATCH /api/finance/users/request-role
 * Submit or update current user's requested role
 *
 * Request Body:
 * {
 *   "requestedRole": "analyst" // viewer | analyst | admin
 * }
 */
async function handleRequestRole(request) {
  try {
    const body = await request.json();

    const validationResult = requestRoleSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        validationResult.error.flatten().fieldErrors
      );
    }

    const { requestedRole } = validationResult.data;

    const user = await submitUserRoleRequest(request.user.id, requestedRole);

    const isPending = user.roleRequestStatus === 'pending';

    return successResponse(
      isPending
        ? `Role request for '${requestedRole}' submitted and pending admin approval`
        : `Role preference updated to '${requestedRole}'`,
      { user },
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('Request role error:', error);

    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Failed to submit role request',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}

export const PATCH = withAuth(handleRequestRole, ['viewer', 'analyst', 'admin']);
