# Finance Data Processing & Access Control Backend

A robust Node.js/Express backend for a finance dashboard system featuring role-based access control, financial record management, and aggregated analytics APIs.

---

## Architecture & Design Decisions

### Project Structure

```
├── server.js                 # Entry point, route mounting
├── src/
│   ├── controllers/          # Request handling logic
│   ├── routes/              # Endpoint definitions
│   ├── middlewares/         # Authentication & authorization
│   ├── utils/               # Prisma singleton, shared utilities
│   └── services/            # (Ready for future business logic layer)
├── prisma/
│   └── schema.prisma        # Database schema definition
```

**Key Design Choices:**

1. **Separation of Concerns** - Controllers handle HTTP logic, routes define endpoints, middlewares enforce access control
2. **Prisma ORM** - Type-safe database access with automatic SQL generation
3. **Singleton Pattern** - Single PrismaClient instance prevents connection pool exhaustion
4. **Middleware Chain** - `authenticate` → `authorizeRoles()` → controller for clear security flow
5. **Consistent Response Format** - `{ success: boolean, data?: any, error?: string }`

---

## Features

### 1. User & Role Management
- User registration with email uniqueness validation
- JWT-based authentication (login/logout ready)
- Role definitions: `viewer` | `analyst` | `admin`
- User status tracking (`isActive` flag)
- bcrypt password hashing (10 salt rounds)
- Rate limiting on auth endpoints (5 attempts per 15 minutes)

### 2. Financial Records CRUD
Complete management of financial entries with fields:

| Field | Type | Description |
|-------|------|-------------|
| `amount` | Float | Positive numeric value |
| `type` | String | `"income"` or `"expense"` |
| `category` | String | User-defined category (e.g., "Food", "Salary") |
| `date` | DateTime | Transaction date |
| `note` | String? | Optional description |

**Operations:**
- [x] **Create** - Admin only (`POST /records`)
- [x] **Read** - All authenticated users (`GET /records`) with optional filters
- [x] **Update** - Admin only, ownership verified (`PUT /records/:id`)
- [x] **Delete** - Admin only, ownership verified (`DELETE /records/:id`)

**Advanced Filtering (GET /records):**
```http
GET /records?type=income&category=food&startDate=2025-04-01&endDate=2025-04-30&page=1&limit=20
```

**Pagination Parameters:**
- `page` - Page number (default: 1)
- `limit` - Records per page, max 100 (default: 20)

**Response includes pagination metadata:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 3. Dashboard Summary APIs
Aggregated analytics endpoints for financial dashboards:

| Endpoint | Description |
|----------|-------------|
| `GET /summary/total-income` | Sum of all income records |
| `GET /summary/total-expense` | Sum of all expense records |
| `GET /summary/net-balance` | Income minus expense (includes breakdown) |
| `GET /summary/category-wise` | Grouped totals by category and type |
| `GET /summary/recent?limit=10` | Recent transactions (configurable limit, max 100) |
| `GET /summary/monthly-trends` | Monthly income vs expense trends |

**Example Response (Net Balance):**
```json
{
  "success": true,
  "data": {
    "netBalance": 4500.00,
    "totalIncome": 10000.00,
    "totalExpense": 5500.00
  }
}
```

### 4. Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Viewer** | View own records, access all summary/dashboard endpoints |
| **Analyst** | Same as viewer (no additional write access) |
| **Admin** | Full CRUD on all records (create, update, delete), user management (future) |

**Permission Details:**
- All authenticated users can view their own records via `GET /records`
- Only **Admin** can create (`POST /records`), update (`PUT /records/:id`), or delete (`DELETE /records/:id`) records
- **Viewer, Analyst, and Admin** all have access to summary/dashboard endpoints (`/summary/*`)
- Ownership verification ensures users can only modify their own records (admins included)

**Enforcement:**
- `authenticate` middleware - Validates JWT, attaches user to `req.user`
- `authorizeRoles(...roles)` middleware - Checks `req.user.role` against allowed roles
- Ownership checks - Users can only modify their own records (admin restriction)

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **Prisma** | ORM for database access |
| **SQLite** | Lightweight file-based database |
| **JWT** | Token-based authentication |
| **bcrypt** | Password hashing |
| **Zod** | (Available) Schema validation |

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Steps

1. **Clone and navigate**
```bash
cd finance-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
[!] **SECURITY IMPORTANT**: Never commit your `.env` file to version control!
Create `.env` file in root:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```
The `.env` file is already listed in `.gitignore` to prevent accidental commits. Keep your secrets safe!

4. **Generate Prisma client & migrate database**
```bash
npx prisma generate
npx prisma migrate dev --name init
```

5. **Start server**
```bash
node server.js
# or with auto-reload:
npx nodemon server.js
```

Server will run at: `http://localhost:3000`

---

## Authentication Flow

```
1. Register: POST /auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "password123",
     "role": "analyst"  // optional, defaults to "viewer"
   }

2. Login: POST /auth/login
   {
     "email": "john@example.com",
     "password": "password123"
   }

3. Response includes JWT token:
   {
     "success": true,
     "data": {
       "token": "eyJhbGc...",
       "user": { "id": 1, "name": "...", "role": "analyst" }
     }
   }

4. Use token in Authorization header:
   Authorization: Bearer <token>

5. Access protected routes (all /records and /summary endpoints)
```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/auth/register` | Public | Create new user |
| `POST` | `/auth/login` | Public | Authenticate and get JWT |

---

### Records Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/records` | Auth | Get all records (with optional filters) |
| `POST` | `/records` | Admin | Create new record |
| `PUT` | `/records/:id` | Admin | Update record (ownership check) |
| `DELETE` | `/records/:id` | Admin | Delete record (ownership check) |

**GET /records Query Parameters:**
- `type` - Filter by `"income"` or `"expense"`
- `category` - Partial case-insensitive match
- `startDate` - ISO date string (inclusive)
- `endDate` - ISO date string (inclusive)

---

### Summary Endpoints

All require authentication; Analyst/Admin roles recommended.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/summary/total-income` | Returns `{ "totalIncome": number }` |
| `GET` | `/summary/total-expense` | Returns `{ "totalExpense": number }` |
| `GET` | `/summary/net-balance` | Returns `{ "netBalance", "totalIncome", "totalExpense" }` |
| `GET` | `/summary/category-wise` | Returns `[ { "category", "type", "totalAmount" } ]` sorted by amount |
| `GET` | `/summary/recent?limit=10` | Returns `[ ...record objects ]` most recent first |
| `GET` | `/summary/monthly-trends` | Returns `[ { "month": "YYYY-MM", "totalIncome", "totalExpense" } ]` sorted chronologically |

---

## Testing

### Automated Tests

This project includes comprehensive unit and integration tests using Jest and Supertest.

**Run tests:**
```bash
npm test
```

**Run tests with coverage report:**
```bash
npm test
# Coverage is included by default via --coverage flag
```

**Watch mode for development:**
```bash
npm run test:watch
```

**Test Coverage:** Currently at **72%+ line coverage** across controllers, middlewares, and routes.

**Test Suite Includes:**
- [x] Authentication tests: register, login, validation, duplicate emails
- [x] Authorization tests: role-based access control, permission enforcement
- [x] Summary endpoint tests: aggregate calculations, pagination, sorting, date handling
- [x] Database cleanup and test isolation

### Manual Testing with cURL

1. **Register a user:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "mypassword",
    "role": "admin"
  }'
```

2. **Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "mypassword"
  }'
```
Copy the `token` from response.

3. **Create a record:**
```bash
curl -X POST http://localhost:3000/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": 5000.00,
    "type": "income",
    "category": "Salary",
    "date": "2025-04-01T00:00:00.000Z",
    "note": "Monthly salary"
  }'
```

4. **Get summary:**
```bash
curl -X GET "http://localhost:3000/summary/net-balance" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **Get records with pagination:**
```bash
curl -X GET "http://localhost:3000/records?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Database Schema

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  role      String   // "viewer" | "analyst" | "admin"
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  records   Record[]
}

model Record {
  id        Int      @id @default(autoincrement())
  amount    Float
  type      String   // "income" | "expense"
  category  String
  date      DateTime
  note      String?
  createdAt DateTime @default(now())

  userId    Int
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## Assumptions & Constraints

1. **One user per record** - Each record belongs to exactly one user (no shared records)
2. **Admin-only writes** - Only users with `admin` role can create, update, or delete records
3. **Ownership verification** - Admin updates/deletes must still match `userId` to prevent IDOR attacks
4. **All-time summaries** - No date filtering on summary endpoints (shows complete history)
5. **SQLite for simplicity** - File-based database suitable for assessment; production would use PostgreSQL/MySQL
6. **JWT expiration** - Default 7 days (`JWT_EXPIRES_IN` configurable)
7. **Pagination on records** - Default limit 20, max 100; configurable via `?page=` and `?limit=` query parameters
8. **Category as string** - No separate category model; free-form strings accepted
9. **Viewer access to summaries** - All authenticated roles (viewer, analyst, admin) can access dashboard summary data
10. **Rate limiting** - Authentication endpoints limited to 5 requests per 15 minutes per IP address

---

## Validation & Error Handling

**Input Validation per Endpoint:**

- **Amount**: Must be positive number (> 0)
- **Type**: Must be exactly `"income"` or `"expense"`
- **Category**: Required, non-empty string (trimmed)
- **Date**: Valid ISO date string or Date-compatible format
- **ID params**: Must be parseable integer
- **Email**: Basic regex validation (`^\S+@\S+\.\S+$`)
- **Password**: Minimum 6 characters

**HTTP Status Codes Used:**

| Code | Usage |
|------|-------|
| `200` | Success (GET/PUT/DELETE) |
| `201` | Resource created (POST) |
| `400` | Validation failed (bad request) |
| `401` | Missing/invalid JWT token |
| `403` | Insufficient permissions (wrong role) |
| `404` | Record not found |
| `409` | Duplicate email (user already exists) |
| `500` | Server error (unhandled exceptions) |

**Error Response Format:**
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## Implementation Highlights

### 1. Ownership Verification Pattern
```javascript
// Find record with both ID and userId
const existingRecord = await prisma.record.findFirst({
  where: { id, userId }
});

if (!existingRecord) {
  return res.status(404).json({
    success: false,
    error: 'Record not found or access denied'
  });
}
```
Prevents unauthorized access while maintaining security semantics.

---

### 2. Aggregate Queries for Performance
```javascript
// Total income
const result = await prisma.record.aggregate({
  where: { userId, type: 'income' },
  _sum: { amount: true }
});
```
Efficient database-level aggregation; no data transfer overhead.

---

### 3. Monthly Trends with Client-Side Grouping
```javascript
// Fetch all records (SQLite lacks date extraction functions)
const records = await prisma.record.findMany({ where: { userId } });

// Group by YYYY-MM in JavaScript
const monthlyData = {};
records.forEach(record => {
  const monthKey = formatDate(record.date); // "2025-04"
  // accumulate...
});
```
Workaround for SQLite's limited date functions while maintaining correctness.

---

## Design Reflections

### What Went Well

[x] **Clear separation of concerns** - Controllers, routes, middlewares all have distinct responsibilities
[x] **Reusable middleware** - `authenticate` and `authorizeRoles` compose cleanly
[x] **Consistent patterns** - All controllers follow same error handling/response pattern
[x] **Security-first** - Ownership checks, password hashing, JWT validation
[x] **Scalable design** - Easy to add new summary endpoints or record fields
[x] **Production-ready** - Singleton PrismaClient, graceful shutdown, query logging in dev

### Future Improvements

 **Service layer** - Move business logic from controllers to services for reusability
 **Soft deletes** - Use `deletedAt` field instead of hard deletes for audit trail
 **Rate limiting** - Prevent abuse of public auth endpoints (implemented in this version)
 **Unit tests** - Jest/Mocha tests for controllers and middlewares (see testing section)
 **Swagger/OpenAPI** - Auto-generated API documentation
 **Caching** - Redis for frequently accessed summary data

---

## Quick Reference

### Environment Variables
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET=change-this-to-random-string
PORT=3000
NODE_ENV=development
```

### Database Commands
```bash
npx prisma generate        # Generate TypeScript client
npx prisma migrate dev     # Create/apply migrations
npx prisma studio          # Open database GUI (optional)
```

### Useful Middleware Order
```
1. express.json()        # Parse request body
2. authenticate          # Verify JWT, set req.user
3. authorizeRoles(...)   # Check user.role
4. Controller            # Business logic
```

---

## License

ISC (as per `package.json`)
