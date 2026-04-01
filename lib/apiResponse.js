import { NextResponse } from 'next/server';

/**
 * API Response Helper
 * Ensures consistent response format across all finance dashboard APIs
 * 
 * Success: { success: true, message: "...", data: {...} }
 * Error: { success: false, message: "...", errors: [...] }
 */

/**
 * Creates a standardized success response
 * @param {string} message - Success message
 * @param {object} data - Response data payload
 * @param {number} status - HTTP status code (default: 200)
 * @returns {NextResponse} JSON response
 */
export function successResponse(message, data = null, status = 200) {
  const responseBody = {
    success: true,
    message
  };

  if (data !== null) {
    responseBody.data = data;
  }

  return NextResponse.json(responseBody, { status });
}

/**
 * Creates a standardized error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 400)
 * @param {array|object} errors - Optional validation errors or details
 * @returns {NextResponse} JSON response
 */
export function errorResponse(message, status = 400, errors = null) {
  const responseBody = {
    success: false,
    message
  };

  if (errors !== null) {
    responseBody.errors = errors;
  }

  return NextResponse.json(responseBody, { status });
}

/**
 * HTTP Status Code Constants for readability
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};
