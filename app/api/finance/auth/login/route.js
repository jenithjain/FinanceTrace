import { loginUser } from '@/lib/services/auth.service';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { z } from 'zod';

/**
 * Login Schema
 * Validates user login input
 */
const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
});

/**
 * POST /api/finance/auth/login
 * Authenticates a user and returns a JWT token
 * 
 * Request Body:
 * {
 *   "email": "john@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": { "user": {...}, "token": "..." }
 * }
 */
export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        validationResult.error.flatten().fieldErrors
      );
    }

    const { email, password } = validationResult.data;

    // Call service to authenticate user
    const { user, token } = await loginUser(email, password);

    return successResponse(
      'Login successful. Welcome back!',
      { user, token },
      HTTP_STATUS.OK
    );

  } catch (error) {
    console.error('Login error:', error);

    // Handle known errors with status codes
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse(
      'Login failed. Please try again.',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}
