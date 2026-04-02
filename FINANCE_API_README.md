# Finance Dashboard Backend API

A clean, well-structured Finance Dashboard Backend built with Next.js API Routes, MongoDB, and JWT authentication. Features role-based access control (RBAC), transaction management, and dashboard analytics using MongoDB Aggregation Pipeline.

> **Built for:** Internship Assignment - Backend Development Assessment  
> **Focus:** Clean code, separation of concerns, maintainability

---

## 🚀 Tech Stack

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **Next.js 14** | API Routes | Unified codebase (frontend + backend), built-in routing, serverless-ready |
| **MongoDB Atlas** | Database | Document model fits financial records, powerful aggregation pipeline for analytics |
| **Mongoose** | ODM | Schema validation, middleware hooks, clean data modeling |
| **JWT** | Authentication | Stateless auth, easy to implement, works great with APIs |
| **Zod** | Validation | Type-safe validation, excellent error messages, great DX |
| **bcryptjs** | Password Hashing | Secure password storage with salt rounds |

---

## 📁 Project Structure

```
src/
├── app/api/finance/           # All finance API routes
│   ├── auth/
│   │   ├── register/route.js  # POST - User registration
│   │   └── login/route.js     # POST - User login
│   ├── users/
│   │   ├── route.js           # GET - List all users
│   │   └── [id]/
│   │       ├── route.js       # GET, DELETE - Single user
│   │       ├── role/route.js  # PATCH - Update role
│   │       └── status/route.js # PATCH - Update status
│   ├── transactions/
│   │   ├── route.js           # GET, POST - List/Create
│   │   └── [id]/route.js      # GET, PATCH, DELETE - Single transaction
│   └── dashboard/
│       ├── summary/route.js   # GET - Financial totals
│       ├── by-category/route.js # GET - Category breakdown
│       ├── trends/route.js    # GET - Monthly trends
│       └── recent/route.js    # GET - Recent activity
│
├── lib/
│   ├── mongodb.js             # Database connection (singleton)
│   ├── jwt.js                 # JWT sign/verify helpers
│   ├── apiResponse.js         # Consistent response format
│   ├── middleware/
│   │   └── withAuth.js        # Auth & role-checking HOF
│   ├── models/
│   │   ├── User.js            # User schema with roles
│   │   └── Transaction.js     # Transaction schema
│   ├── services/
│   │   ├── auth.service.js    # Auth business logic
│   │   ├── user.service.js    # User management logic
│   │   ├── transaction.service.js # Transaction CRUD
│   │   └── dashboard.service.js # Aggregation pipelines
│   └── validations/
│       ├── user.validator.js  # User Zod schemas
│       └── transaction.validator.js # Transaction Zod schemas
│
└── scripts/
    └── seed.js                # Database seeder
```

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### 1. Clone & Install

```bash
git clone <repository-url>
cd <project-folder>
npm install
```

### 2. Environment Setup

Create `.env` file in root:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/finance-dashboard
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d
```

### 3. Seed Database (Optional but Recommended)

```bash
node scripts/seed.js
```

This creates:
- 3 users (admin, analyst, viewer)
- 80+ sample transactions across all categories

### 4. Run Development Server

```bash
npm run dev
```

API available at: `http://localhost:3000/api/finance`

---

## 📋 API Endpoints

### Authentication (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/finance/auth/register` | Register new user |
| POST | `/api/finance/auth/login` | Login, get JWT token |

### Users (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finance/users` | List all users |
| GET | `/api/finance/users/:id` | Get single user |
| PATCH | `/api/finance/users/:id/role` | Update user role |
| PATCH | `/api/finance/users/:id/status` | Activate/deactivate user |
| DELETE | `/api/finance/users/:id` | Delete user |

### Transactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/finance/transactions` | Analyst, Admin | List with filters & pagination |
| POST | `/api/finance/transactions` | Admin | Create transaction |
| GET | `/api/finance/transactions/:id` | Analyst, Admin | Get single transaction |
| PATCH | `/api/finance/transactions/:id` | Admin | Update transaction |
| DELETE | `/api/finance/transactions/:id` | Admin | Soft delete transaction |

### Dashboard (All Authenticated Users)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finance/dashboard/summary` | Total income, expenses, net balance |
| GET | `/api/finance/dashboard/by-category` | Totals grouped by category |
| GET | `/api/finance/dashboard/trends` | Monthly breakdown for current year |
| GET | `/api/finance/dashboard/recent` | Last N transactions |

---

## 🔐 Role Permissions

| Action | Viewer | Analyst | Admin |
|--------|:------:|:-------:|:-----:|
| View Dashboard | ✅ | ✅ | ✅ |
| List Transactions | ❌ | ✅ | ✅ |
| View Single Transaction | ❌ | ✅ | ✅ |
| Create Transaction | ❌ | ❌ | ✅ |
| Update Transaction | ❌ | ❌ | ✅ |
| Delete Transaction | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |

---

## 📝 API Response Format

All APIs return consistent JSON structure:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "What went wrong",
  "errors": { ... }  // Optional: validation errors
}
```

### HTTP Status Codes Used
- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (wrong role / inactive account)
- `404` - Not Found
- `409` - Conflict (duplicate email)
- `500` - Internal Server Error

---

## 🧪 Testing with Postman/cURL

### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/finance/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/finance/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@finance.com","password":"Admin@123"}'
```

### 3. Access Protected Route
```bash
curl http://localhost:3000/api/finance/dashboard/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Create Transaction (Admin)
```bash
curl -X POST http://localhost:3000/api/finance/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"amount":5000,"type":"income","category":"Salary","date":"2024-01-15"}'
```

---

## 🎯 Design Decisions & Assumptions

### Decisions Made

1. **Soft Delete for Transactions**
   - Records are marked `isDeleted: true` instead of removed
   - Maintains audit trail for financial data
   - All queries filter by `isDeleted: false`

2. **Hard Delete for Users**
   - Admin decision to permanently remove users
   - Simpler than soft delete for user management

3. **Separate JWT Auth System**
   - Independent from NextAuth (used for frontend)
   - Cleaner separation for API authentication
   - Easier to test and explain

4. **MongoDB Aggregation for Dashboard**
   - All calculations done at database level
   - Better performance than JS post-processing
   - Scales with data volume

5. **Namespace: `/api/finance/`**
   - Avoids conflicts with existing routes
   - Clear separation from other features

### Assumptions

1. New users default to `viewer` role (minimum permissions)
2. First admin created via seed script or manual DB update
3. Dates stored in UTC timezone
4. Currency not stored (assumed single currency)
5. Categories are free-form strings (not predefined enum)

---

## ⚠️ Known Limitations & Tradeoffs

| Limitation | Reason |
|------------|--------|
| No refresh tokens | Kept simple for assignment scope |
| No rate limiting | Can be added with middleware |
| No email verification | Out of scope for assignment |
| No password reset | Out of scope for assignment |
| Single currency | Simplicity - can extend for multi-currency |

---

## 🔒 Security Features

- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ JWT token expiration (7 days default)
- ✅ Role-based access control
- ✅ User status check (inactive users blocked)
- ✅ Input validation with Zod
- ✅ MongoDB ObjectId validation
- ✅ No password in API responses
- ✅ Environment variables for secrets

---

## 📊 Seed Data Credentials

After running `node scripts/seed.js`:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@finance.com | Admin@123 |
| Analyst | analyst@finance.com | Analyst@123 |
| Viewer | viewer@finance.com | Viewer@123 |

---

## 🏗️ Architecture Highlights

### Separation of Concerns
```
Route Handlers → Services → Models → Database
     ↓              ↓          ↓
  HTTP logic   Business    Data
  Validation    Logic     Access
```

### Middleware Pattern
```javascript
export const GET = withAuth(handler, ['admin', 'analyst']);
//                    ↓           ↓
//              Route handler   Allowed roles
```

### Consistent Response Helper
```javascript
return successResponse('Message', data, 200);
return errorResponse('Error message', 400, validationErrors);
```

---

## 📈 Future Enhancements

- [ ] Pagination cursor for large datasets
- [ ] Rate limiting middleware
- [ ] Request logging
- [ ] Unit tests with Jest
- [ ] API documentation with Swagger
- [ ] Export to CSV/PDF
- [ ] Multi-currency support
- [ ] Date range analytics

---

## 👨‍💻 Author

Built with ❤️ for internship assignment evaluation.

**Focus Areas Demonstrated:**
- Clean, readable code
- Proper separation of concerns
- RESTful API design
- Role-based access control
- MongoDB aggregation expertise
- Error handling best practices
- Consistent API responses
