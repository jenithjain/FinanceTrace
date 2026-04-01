import { registerUser } from '@/lib/services/auth.service';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import { z } from 'zod';

/**
 * Registration Schema
 * Validates user registration input
 */
const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please enter a valid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
  requestedRole: z
    .enum(['viewer', 'analyst', 'admin'])
    .optional()
});

/**
 * POST /api/finance/auth/register
 * Registers a new user in the finance system
 * 
 * Request Body:
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "password": "securepassword123"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Registration successful",
 *   "data": { "user": {...}, "token": "..." }
 * }
 */
export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse(
        'Validation failed',
        HTTP_STATUS.BAD_REQUEST,
        validationResult.error.flatten().fieldErrors
      );
    }

    // Call service to register user
    const { user, token } = await registerUser(validationResult.data);

    return successResponse(
      'Registration successful. Welcome to Finance Dashboard!',
      { user, token },
      HTTP_STATUS.CREATED
    );

  } catch (error) {
    console.error('Registration error:', error);

    // Handle known errors with status codes
    if (error.statusCode) {
      return errorResponse(error.message, error.statusCode);
    }

    // Handle duplicate key error (email already exists)
    if (error.code === 11000) {
      return errorResponse(
        'An account with this email already exists',
        HTTP_STATUS.CONFLICT
      );
    }

    return errorResponse(
      'Registration failed. Please try again.',
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
}
