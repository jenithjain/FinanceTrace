import { z } from 'zod';

/**
 * User Validation Schemas
 * Zod schemas for validating user management operations
 */

/**
 * Valid role values for the finance dashboard
 */
export const VALID_ROLES = ['viewer', 'analyst', 'admin'];

/**
 * Valid status values for user accounts
 */
export const VALID_STATUSES = ['active', 'inactive'];

/**
 * Schema for updating a user's role
 * Used in: PATCH /api/finance/users/[id]/role
 */
export const updateRoleSchema = z.object({
  role: z
    .string({
      required_error: 'Role is required',
      invalid_type_error: 'Role must be a string'
    })
    .refine(
      (val) => VALID_ROLES.includes(val),
      {
        message: `Role must be one of: ${VALID_ROLES.join(', ')}`
      }
    )
});

/**
 * Schema for updating a user's status
 * Used in: PATCH /api/finance/users/[id]/status
 */
export const updateStatusSchema = z.object({
  status: z
    .string({
      required_error: 'Status is required',
      invalid_type_error: 'Status must be a string'
    })
    .refine(
      (val) => VALID_STATUSES.includes(val),
      {
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
      }
    )
});

/**
 * Helper function to format Zod validation errors
 * Converts Zod error format to a cleaner object for API responses
 * @param {z.ZodError} zodError - Zod validation error
 * @returns {object} Formatted field errors
 */
export function formatZodErrors(zodError) {
  return zodError.flatten().fieldErrors;
}
