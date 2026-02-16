# Drone Delivery Management Backend

A production-grade REST API for managing drone-based delivery operations, built with **NestJS**, **TypeScript**, **TypeORM**, and **MongoDB**.

Supports three user roles — **admin**, **enduser**, and **drone** — each with JWT-authenticated, role-locked endpoints.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# 3. Start the server
npm run start

# Server runs at http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | — | MongoDB connection string (Atlas or local) |
| `MONGODB_DATABASE` | `drone-delivery` | Database name |
| `JWT_SECRET` | `drone-delivery-jwt-secret-2024` | Secret key for signing JWTs |
| `JWT_EXPIRES_IN_SECONDS` | `28800` | Token lifetime (default 8 hours) |
| `PORT` | `3000` | Server port |

---

## Architecture

```
src/
├── auth/           # Signup, signin, signout, password reset, JWT strategy
│   ├── dto/        # SignupDto, SigninDto, ForgotPasswordDto, ResetPasswordDto, CreateTokenDto
│   ├── entities/   # User, TokenBlacklist
│   └── strategies/ # Passport JWT strategy with blacklist check
├── drone/          # Drone operations (reserve, grab, deliver, heartbeat)
├── order/          # Enduser order management (submit, withdraw, track)
├── admin/          # Admin bulk operations (orders, drones, status)
├── job/            # Job entity & service (shared across modules)
└── common/
    ├── guards/     # JwtAuthGuard, RolesGuard (RBAC)
    ├── decorators/ # @Roles, @CurrentUser
    ├── enums/      # UserType, OrderStatus, JobStatus, DroneStatus
    ├── filters/    # Global exception filter
    └── utils/      # Haversine distance & ETA calculation
```

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Database | MongoDB (Atlas or local) |
| ORM | TypeORM with auto-sync |
| Auth | JWT (Passport) with bcrypt password hashing |
| Docs | Swagger / OpenAPI |
| Testing | Jest + Supertest + mongodb-memory-server |
| CI/CD | GitHub Actions (lint, build, e2e) |

---

## Authentication

The API uses a full authentication system with user accounts, password hashing, and session management.

### Auth Flow

1. **Sign up** — Create an account with email, password, and name. Returns a JWT valid for 8 hours.
2. **Sign in** — Authenticate with email and password. Returns a fresh JWT.
3. **Sign out** — Blacklists the current token. It will be rejected on subsequent requests.
4. **Forgot/reset password** — Request a short-lived reset token, then set a new password.

### Token Lifecycle

- Tokens are valid for **8 hours** from issuance
- Tokens are invalidated immediately on **signout** (blacklisted)
- Blacklisted tokens are rejected on every authenticated request via the JWT strategy

### Drone Token Registration

Drone tokens are generated via `POST /auth/token` and **require admin authentication**. An admin must provide their bearer token to register a new drone.

```bash
# 1. Sign up as admin
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "SecureP@ss1", "name": "admin", "type": "admin"}'

# 2. Register a drone token (admin-only)
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"name": "drone-alpha", "type": "drone"}'

# 3. Use tokens on protected endpoints
curl http://localhost:3000/orders \
  -H "Authorization: Bearer <enduser-token>"
```

User types: `admin`, `enduser`, `drone`

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/signup` | Public | Register a new user account |
| `POST` | `/auth/signin` | Public | Sign in with email & password |
| `POST` | `/auth/signout` | Bearer | Invalidate current token |
| `POST` | `/auth/forgot-password` | Public | Request a password reset token |
| `POST` | `/auth/reset-password` | Public | Reset password with reset token |
| `POST` | `/auth/token` | Admin | Generate JWT for a drone (admin-only) |

### Orders (Enduser)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/orders` | Submit order with origin & destination |
| `DELETE` | `/orders/:id` | Withdraw order (if not yet picked up) |
| `GET` | `/orders` | List your orders (filterable by status) |
| `GET` | `/orders/:id` | Order detail with progress, drone location & ETA |

### Drones
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/drones/jobs/reserve` | Reserve the next open job |
| `POST` | `/drones/jobs/:jobId/grab` | Grab order from origin/broken drone |
| `PATCH` | `/drones/jobs/:jobId/complete` | Mark as delivered or failed |
| `PATCH` | `/drones/status/broken` | Mark broken (triggers handoff job) |
| `PATCH` | `/drones/heartbeat` | Update location & receive status |
| `GET` | `/drones/current-order` | Get currently assigned order details |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/orders` | Bulk list all orders (paginated, filterable) |
| `PATCH` | `/admin/orders/:id/location` | Change origin or destination |
| `GET` | `/admin/drones` | List all drones |
| `PATCH` | `/admin/drones/:id/status` | Mark drone as broken or fixed |

> Full interactive docs at **http://localhost:3000/api/docs**

---

## Order Lifecycle

```
                    ┌──────────┐
                    │  PENDING  │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼                     ▼
        ┌───────────┐        ┌───────────┐
        │ WITHDRAWN │        │RESERVED by│
        │ (enduser) │        │  a drone  │
        └───────────┘        └─────┬─────┘
                                   │
                                   ▼
                          ┌──────────────┐
                          │ IN_PROGRESS  │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌───────────┐ ┌─────────┐ ┌──────────────┐
             │ DELIVERED  │ │ FAILED  │ │PENDING_HANDOFF│
             └───────────┘ └─────────┘ └──────┬───────┘
                                               │
                                               ▼
                                      New HANDOFF job
                                      (another drone
                                       picks it up)
```

### Broken Drone Handoff

When a drone marks itself as broken while carrying an order:
1. The drone's current job is marked **FAILED**
2. The order moves to **PENDING_HANDOFF**
3. A new **HANDOFF** job is created with pickup at the broken drone's last known location
4. Any other available drone can reserve and complete the handoff
5. Even if the broken drone is fixed, the handoff job remains active

---

## Testing

### E2E Tests

```bash
# Run all 43 E2E tests
npm run test:e2e
```

E2E tests use **mongodb-memory-server** — an in-memory MongoDB instance that requires no external database. Tests run in CI without any service dependencies.

**Test coverage includes:**
- JWT generation, authentication & token blacklisting
- Admin-only drone token registration (401/403 for unauthorized)
- RBAC guards (cross-role access denied)
- Full order lifecycle (submit -> reserve -> grab -> deliver)
- Broken drone handoff flow
- Order withdrawal (before and after pickup)
- Admin bulk operations & location updates
- Edge cases (duplicate reservations, cross-drone grabs, coordinate validation)


---

## CI/CD

GitHub Actions pipeline runs on every push/PR to `main`:

| Job | Description |
|---|---|
| **Lint** | ESLint + Prettier format check |
| **Build** | TypeScript compilation |
| **E2E Tests** | Full test suite with in-memory MongoDB |
| **Status Check** | Gate — all jobs must pass |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start the server |
| `npm run start:dev` | Start with hot-reload |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run test:e2e` | Run E2E test suite |
| `npm run lint` | Lint & auto-fix |
| `npm run format` | Format with Prettier |

---

## Design Decisions

- **MongoDB** — Document-oriented database for flexible schema evolution. Uses MongoDB Atlas in production, mongodb-memory-server for testing.
- **bcrypt password hashing** — Passwords are hashed with bcrypt (10 salt rounds) before storage. Plain-text passwords are never persisted.
- **Token blacklisting** — Sign-out invalidates tokens immediately via a database-backed blacklist, checked on every authenticated request.
- **Admin-gated drone registration** — Drone tokens can only be generated by authenticated admin users, preventing unauthorized drone enrollment.
- **Auto-registration** — Drones are created in the system on first heartbeat/action, no manual entity setup needed.
- **ETA calculation** — Uses Haversine distance with estimated drone speed for real-time ETA.
- **Optimistic locking** — Job version field prevents two drones from reserving the same job.
- **Global exception filter** — Consistent error response format across all endpoints.

---

## License

MIT
