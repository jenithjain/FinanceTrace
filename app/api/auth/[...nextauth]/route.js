import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { signToken } from "@/lib/jwt";

const VALID_ROLES = ['viewer', 'analyst', 'admin'];

function normalizeRequestedRole(role) {
  if (!role || typeof role !== 'string') {
    return 'viewer';
  }

  const normalizedRole = role.toLowerCase().trim();
  return VALID_ROLES.includes(normalizedRole) ? normalizedRole : 'viewer';
}

function getRoleRequestDefaults(requestedRole) {
  return {
    requestedRole,
    roleRequestStatus: 'pending'
  };
}

export const authOptions = {
  providers: [
    // Email/Password Authentication
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        requestedRole: { label: "Requested Role", type: "text" },
        mode: { label: "Mode", type: "text" } // 'signin' or 'signup'
      },
      async authorize(credentials) {
        try {
          await dbConnect();

          const { email, password, name, mode, requestedRole } = credentials;

          // Validate inputs
          if (!email || !password) {
            throw new Error('Email and password are required');
          }

          const normalizedEmail = email.toLowerCase().trim();
          const normalizedRequestedRole = normalizeRequestedRole(requestedRole);
          const roleRequestDefaults = getRoleRequestDefaults(normalizedRequestedRole);

          if (mode === 'signup') {
            // Sign Up Flow
            if (!name || name.trim().length < 2) {
              throw new Error('Please provide your full name');
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email: normalizedEmail });
            if (existingUser) {
              throw new Error('An account with this email already exists');
            }

            // Validate password strength (additional server-side check)
            if (password.length < 8) {
              throw new Error('Password must be at least 8 characters');
            }

            // Create new user
            const newUser = await User.create({
              email: normalizedEmail,
              password,
              name: name.trim(),
              authProvider: 'credentials',
              hasCompletedKYC: true,
              role: 'viewer',
              ...roleRequestDefaults,
              roleRequestUpdatedAt: new Date(),
              status: 'inactive'
            });

            // Do not auto-login new accounts. Admin must approve first.
            throw new Error(
              `Account created with '${newUser.requestedRole}' request. Pending admin approval before first login.`
            );
          } else {
            // Sign In Flow
            const user = await User.findOne({ email: normalizedEmail });
            
            if (!user) {
              throw new Error('Account not found. Please sign up first.');
            }

            // Check if user is active
            if (user.status === 'inactive') {
              if (user.roleRequestStatus === 'pending') {
                throw new Error('Your account is pending admin approval. Please try again after approval.');
              }
              throw new Error('Your account is inactive. Please contact an admin.');
            }

            // Check if user signed up with different provider
            if (user.authProvider !== 'credentials') {
              throw new Error(`This account uses ${user.authProvider} sign-in. Please use the ${user.authProvider} button to continue.`);
            }

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
              throw new Error('Invalid email or password');
            }

            // Generate finance JWT token
            const financeToken = signToken({ userId: user._id, role: user.role });

            return {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              hasCompletedKYC: user.hasCompletedKYC,
              image: user.image,
              role: user.role || 'viewer',
              requestedRole: user.requestedRole || user.role || 'viewer',
              roleRequestStatus: user.roleRequestStatus || 'none',
              status: user.status || 'active',
              authProvider: user.authProvider,
              financeToken
            };
          }
        } catch (error) {
          console.error('Auth error:', error);
          throw error;
        }
      }
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    })
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account.provider === 'google') {
          await dbConnect();

          const normalizedEmail = user.email.toLowerCase().trim();

          // Check if user exists
          let existingUser = await User.findOne({ email: normalizedEmail });

          if (!existingUser) {
            // Create new user for Google OAuth
            existingUser = await User.create({
              email: normalizedEmail,
              name: user.name,
              image: user.image,
              googleId: profile.sub,
              authProvider: 'google',
              hasCompletedKYC: true,
              role: 'viewer',
              requestedRole: 'viewer',
              roleRequestStatus: 'none',
              roleRequestUpdatedAt: new Date(),
              status: 'inactive'
            });
          } else {
            // Check if user signed up with credentials
            if (existingUser.authProvider === 'credentials' && !existingUser.googleId) {
              // Link Google account to existing credentials account
              existingUser.googleId = profile.sub;
              existingUser.authProvider = 'google';
              existingUser.image = user.image;
              await existingUser.save();
            } else if (existingUser.authProvider !== 'google') {
              throw new Error(`This account uses ${existingUser.authProvider} sign-in`);
            }
          }

          // Generate finance JWT token for Google users
          const financeToken = signToken({ userId: existingUser._id, role: existingUser.role || 'viewer' });

          user.id = existingUser._id.toString();
          user.hasCompletedKYC = existingUser.hasCompletedKYC;
          user.role = existingUser.role || 'viewer';
          user.requestedRole = existingUser.requestedRole || existingUser.role || 'viewer';
          user.roleRequestStatus = existingUser.roleRequestStatus || 'none';
          user.status = existingUser.status || 'active';
          user.authProvider = existingUser.authProvider;
          user.financeToken = financeToken;
        }

        return true;
      } catch (error) {
        console.error('SignIn callback error:', error);
        return false;
      }
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.hasCompletedKYC = user.hasCompletedKYC;
        token.role = user.role;
        token.requestedRole = user.requestedRole;
        token.roleRequestStatus = user.roleRequestStatus;
        token.status = user.status;
        token.authProvider = user.authProvider;
        token.financeToken = user.financeToken;
      }

      // Update token when KYC is completed
      if (trigger === 'update' && session?.hasCompletedKYC !== undefined) {
        token.hasCompletedKYC = session.hasCompletedKYC;
      }

      if (trigger === 'update' && session?.role) {
        token.role = session.role;
      }

      if (trigger === 'update' && session?.requestedRole) {
        token.requestedRole = session.requestedRole;
      }

      if (trigger === 'update' && session?.roleRequestStatus) {
        token.roleRequestStatus = session.roleRequestStatus;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.hasCompletedKYC = token.hasCompletedKYC;
        session.user.role = token.role;
        session.user.requestedRole = token.requestedRole;
        session.user.roleRequestStatus = token.roleRequestStatus;
        session.user.status = token.status;
        session.user.authProvider = token.authProvider;
        session.financeToken = token.financeToken;
      }
      return session;
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
