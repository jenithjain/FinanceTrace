import { verifyToken, extractTokenFromHeader } from '@/lib/jwt';
import { errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

/**
 * withAuth - Higher Order Function for route protection
 * 
 * Wraps API route handlers to provide:
 * 1. JWT token verification
 * 2. User status validation (must be active)
 * 3. Role-based access control
 * 
 * Usage:
 *   export const GET = withAuth(handler, ['admin', 'analyst']);
 *   export const POST = withAuth(handler, ['admin']);
 * 
 * @param {Function} handler - The route handler function
 * @param {string[]} allowedRoles - Array of roles that can access this route
 * @returns {Function} Wrapped handler with authentication
 */
export function withAuth(handler, allowedRoles = []) {
  return async (request, context) => {
    try {
      // Step 1: Extract token from Authorization header
      const token = extractTokenFromHeader(request);
      
      if (!token) {
        return errorResponse(
          'Authentication required. Please provide a valid token.',
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Step 2: Verify and decode token
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (error) {
        return errorResponse(
          error.message || 'Invalid or expired token',
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Step 3: Connect to database and fetch user
      await dbConnect();
      
      const user = await User.findById(decoded.userId)
        .select('-password -__v')
        .lean();

      if (!user) {
        return errorResponse(
          'User not found. Token may be invalid.',
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Step 4: Check if user is active
      if (user.status !== 'active') {
        return errorResponse(
          'Your account is inactive. Please contact an administrator.',
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Step 5: Check role permissions
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return errorResponse(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${user.role}`,
          HTTP_STATUS.FORBIDDEN
        );
      }

      // Step 6: Attach user to request for use in handler
      // We create an enhanced request object with user data
      const authenticatedRequest = request;
      authenticatedRequest.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      };

      // Step 7: Call the actual route handler
      return handler(authenticatedRequest, context);
      
    } catch (error) {
      console.error('Auth middleware error:', error);
      return errorResponse(
        'Authentication failed. Please try again.',
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  };
}

/**
 * Shorthand middleware creators for common role combinations
 */
export const adminOnly = (handler) => withAuth(handler, ['admin']);
export const analystAndAdmin = (handler) => withAuth(handler, ['analyst', 'admin']);
export const allRoles = (handler) => withAuth(handler, ['viewer', 'analyst', 'admin']);
