import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

const VALID_ROLES = ['viewer', 'analyst', 'admin'];
const VALID_ROLE_REQUEST_STATUSES = ['none', 'pending', 'approved', 'rejected'];

function mapUserResponse(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    requestedRole: user.requestedRole || user.role || 'viewer',
    roleRequestStatus: user.roleRequestStatus || 'none',
    roleRequestUpdatedAt: user.roleRequestUpdatedAt,
    status: user.status,
    authProvider: user.authProvider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * User Service
 * Handles user management operations (Admin only)
 * All business logic for user CRUD operations
 */

/**
 * Retrieves all users with optional status filter
 * @param {object} filters - { status: 'active' | 'inactive' }
 * @returns {array} List of users (without passwords)
 */
export async function getAllUsers(filters = {}) {
  await dbConnect();

  const query = {};
  
  // Apply status filter if provided
  if (filters.status && ['active', 'inactive'].includes(filters.status)) {
    query.status = filters.status;
  }

  if (
    filters.roleRequestStatus &&
    VALID_ROLE_REQUEST_STATUSES.includes(filters.roleRequestStatus)
  ) {
    query.roleRequestStatus = filters.roleRequestStatus;
  }

  const users = await User.find(query)
    .select('-password -__v')
    .sort({ createdAt: -1 })
    .lean();

  // Transform _id to id for consistency
  return users.map(mapUserResponse);
}

/**
 * Retrieves a single user by ID
 * @param {string} userId - MongoDB ObjectId string
 * @returns {object} User data (without password)
 * @throws {Error} If user not found or invalid ID
 */
export async function getUserById(userId) {
  await dbConnect();

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId)
    .select('-password -__v')
    .lean();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return mapUserResponse(user);
}

/**
 * Updates a user's role
 * @param {string} userId - MongoDB ObjectId string
 * @param {string} newRole - 'viewer' | 'analyst' | 'admin'
 * @returns {object} Updated user data
 * @throws {Error} If user not found or invalid role
 */
export async function updateUserRole(userId, newRole) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      role: newRole,
      requestedRole: newRole,
      roleRequestStatus: newRole === 'viewer' ? 'none' : 'approved',
      roleRequestUpdatedAt: new Date(),
      updatedAt: new Date()
    },
    { new: true, runValidators: true }
  ).select('-password -__v');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return mapUserResponse(user);
}

/**
 * Updates a user's status (active/inactive)
 * @param {string} userId - MongoDB ObjectId string
 * @param {string} newStatus - 'active' | 'inactive'
 * @returns {object} Updated user data
 * @throws {Error} If user not found
 */
export async function updateUserStatus(userId, newStatus) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { status: newStatus, updatedAt: new Date() },
    { new: true, runValidators: true }
  ).select('-password -__v');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return mapUserResponse(user);
}

/**
 * Submits or updates a user's role request
 * @param {string} userId - MongoDB ObjectId string
 * @param {string} requestedRole - 'viewer' | 'analyst' | 'admin'
 * @returns {object} Updated user data
 */
export async function submitUserRoleRequest(userId, requestedRole) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  if (!VALID_ROLES.includes(requestedRole)) {
    const error = new Error('Invalid role requested');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (requestedRole === user.role) {
    user.requestedRole = user.role;
    user.roleRequestStatus = requestedRole === 'viewer' ? 'none' : 'approved';
    user.roleRequestUpdatedAt = new Date();
    await user.save();
    return mapUserResponse(user);
  }

  if (requestedRole === 'viewer') {
    user.requestedRole = 'viewer';
    user.roleRequestStatus = 'none';
    user.roleRequestUpdatedAt = new Date();
    await user.save();
    return mapUserResponse(user);
  }

  user.requestedRole = requestedRole;
  user.roleRequestStatus = 'pending';
  user.roleRequestUpdatedAt = new Date();
  await user.save();

  return mapUserResponse(user);
}

/**
 * Admin decision on a pending role request
 * @param {string} userId - MongoDB ObjectId string
 * @param {'approve' | 'reject'} action - Decision action
 * @returns {object} Updated user data
 */
export async function resolveUserRoleRequest(userId, action) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  if (!['approve', 'reject'].includes(action)) {
    const error = new Error('Invalid action. Use approve or reject');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (user.roleRequestStatus !== 'pending') {
    const error = new Error('No pending role request for this user');
    error.statusCode = 400;
    throw error;
  }

  if (action === 'approve') {
    const approvedRole = user.requestedRole || user.role || 'viewer';
    user.role = approvedRole;
    user.requestedRole = approvedRole;
    user.roleRequestStatus = approvedRole === 'viewer' ? 'none' : 'approved';
  } else {
    user.requestedRole = user.role || 'viewer';
    user.roleRequestStatus = 'rejected';
  }

  user.roleRequestUpdatedAt = new Date();
  await user.save();

  return mapUserResponse(user);
}

/**
 * Deletes a user permanently (hard delete)
 * @param {string} userId - MongoDB ObjectId string
 * @param {string} requestingUserId - ID of user making the request (to prevent self-delete)
 * @returns {object} Deleted user data
 * @throws {Error} If user not found or trying to delete self
 */
export async function deleteUser(userId, requestingUserId) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Invalid user ID format');
    error.statusCode = 400;
    throw error;
  }

  // Prevent self-deletion
  if (userId === requestingUserId) {
    const error = new Error('You cannot delete your own account');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findByIdAndDelete(userId)
    .select('-password -__v')
    .lean();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    requestedRole: user.requestedRole || user.role || 'viewer',
    roleRequestStatus: user.roleRequestStatus || 'none',
    roleRequestUpdatedAt: user.roleRequestUpdatedAt,
    status: user.status
  };
}
