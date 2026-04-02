import { getServerSession } from 'next-auth';
import { z } from 'zod';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import { authOptions } from '@/lib/auth-options';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';

const onboardingRoleSchema = z.object({
  requestedRole: z.enum(['viewer', 'analyst', 'admin'])
});

async function handleOnboardingRole(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return errorResponse('Authentication required', HTTP_STATUS.UNAUTHORIZED);
    }

    const body = await request.json();
    const validationResult = onboardingRoleSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        validationResult.error.flatten().fieldErrors
      );
    }

    const { requestedRole } = validationResult.data;

    await dbConnect();
    const user = await User.findById(session.user.id);

    if (!user) {
      return errorResponse('User not found', HTTP_STATUS.NOT_FOUND);
    }

    if (user.status === 'active') {
      return successResponse('Account is already active', {
        user: {
          id: user._id.toString(),
          role: user.role,
          requestedRole: user.requestedRole,
          roleRequestStatus: user.roleRequestStatus,
          status: user.status
        }
      });
    }

    user.role = 'viewer';
    user.requestedRole = requestedRole;
    user.roleRequestStatus = 'pending';
    user.roleRequestUpdatedAt = new Date();
    user.status = 'inactive';

    await user.save();

    return successResponse(
      `Role request for '${requestedRole}' submitted and pending admin approval`,
      {
        user: {
          id: user._id.toString(),
          role: user.role,
          requestedRole: user.requestedRole,
          roleRequestStatus: user.roleRequestStatus,
          status: user.status
        }
      },
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('Onboarding role update error:', error);
    return errorResponse('Failed to submit onboarding role request', HTTP_STATUS.INTERNAL_ERROR);
  }
}

export const PATCH = handleOnboardingRole;
