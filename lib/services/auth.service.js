import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import { signToken } from '@/lib/jwt';

const VALID_ROLES = ['viewer', 'analyst', 'admin'];

function normalizeRequestedRole(role) {
  if (!role || typeof role !== 'string') {
    return 'viewer';
  }

  const normalizedRole = role.toLowerCase().trim();
  return VALID_ROLES.includes(normalizedRole) ? normalizedRole : 'viewer';
}

function getRoleRequestDefaults(requestedRole) {
  if (requestedRole === 'viewer') {
    return {
      requestedRole: 'viewer',
      roleRequestStatus: 'none'
    };
  }

  return {
    requestedRole,
    roleRequestStatus: 'pending'
  };
}

/**
 * Auth Service
 * Handles user registration and login logic
 * Separates business logic from route handlers
 */

/**
 * Registers a new user in the system
 * @param {object} userData - { name, email, password }
 * @returns {object} { user, token }
 * @throws {Error} If email already exists or validation fails
 */
export async function registerUser(userData) {
  await dbConnect();

  const { name, email, password } = userData;
  const requestedRole = normalizeRequestedRole(userData.requestedRole);
  const roleRequestDefaults = getRoleRequestDefaults(requestedRole);
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const error = new Error('An account with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  // Create new user (password is hashed via pre-save hook in model)
  const newUser = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    authProvider: 'credentials',
    role: 'viewer', // Default role for new users
    ...roleRequestDefaults,
    roleRequestUpdatedAt: new Date(),
    status: 'active'
  });

  // Generate JWT token
  const token = signToken({
    userId: newUser._id.toString(),
    role: newUser.role
  });

  // Return user data without password
  const userResponse = {
    id: newUser._id.toString(),
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    requestedRole: newUser.requestedRole,
    roleRequestStatus: newUser.roleRequestStatus,
    status: newUser.status,
    createdAt: newUser.createdAt
  };

  return { user: userResponse, token };
}

/**
 * Authenticates a user and returns a token
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {object} { user, token }
 * @throws {Error} If credentials are invalid or user is inactive
 */
export async function loginUser(email, password) {
  await dbConnect();

  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email
  const user = await User.findOne({ email: normalizedEmail });
  
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Check if user signed up with different auth provider
  if (user.authProvider !== 'credentials') {
    const error = new Error(
      `This account uses ${user.authProvider} sign-in. Please use that method to login.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Check if user is active
  if (user.status !== 'active') {
    const error = new Error('Your account is inactive. Please contact an administrator.');
    error.statusCode = 403;
    throw error;
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Generate JWT token
  const token = signToken({
    userId: user._id.toString(),
    role: user.role
  });

  // Return user data without password
  const userResponse = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    requestedRole: user.requestedRole || user.role || 'viewer',
    roleRequestStatus: user.roleRequestStatus || 'none',
    status: user.status,
    createdAt: user.createdAt
  };

  return { user: userResponse, token };
}
