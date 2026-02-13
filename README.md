# 🚁 Drone Delivery Management Backend

A production-grade REST API for managing drone-based delivery operations, built with **NestJS**, **TypeScript**, and **TypeORM**.

Supports three user roles — **admin**, **enduser**, and **drone** — each with JWT-authenticated, role-locked endpoints.

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm run start

# Server runs at http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
```

---

## 🏗️ Architecture

```
src/
├── auth/           # JWT token generation & Passport strategy
├── drone/          # Drone operations (reserve, grab, deliver, heartbeat)
├── order/          # Enduser order management (submit, withdraw, track)
├── admin/          # Admin bulk operations (orders, drones, status)
├── job/            # Job entity & service (shared across modules)
└── common/
    ├── guards/     # JwtAuthGuard, RolesGuard (RBAC)
    ├── decorators/ # @Roles, @CurrentUser
    ├── enums/      # UserType, OrderStatus, JobStatus, DroneStatus
    └── filters/    # Global exception filter
```

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Database | SQLite (via better-sqlite3) |
| ORM | TypeORM with auto-sync |
| Auth | Self-signed JWT (Passport) |
| Docs | Swagger / OpenAPI |
| Testing | Jest + Supertest |

---

## 🔐 Authentication

All endpoints (except token generation) require a **Bearer JWT**.

```bash
# Get a token
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"name": "alice", "type": "enduser"}'

# Use it
curl http://localhost:3000/orders \
  -H "Authorization: Bearer <token>"
```

User types: `admin`, `enduser`, `drone`

---

## 📡 API Endpoints

### 🔑 Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/token` | Generate JWT (name + type) |

### 📦 Orders (Enduser)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/orders` | Submit order with origin & destination |
| `DELETE` | `/orders/:id` | Withdraw order (if not yet picked up) |
| `GET` | `/orders` | List your orders (filterable by status) |
| `GET` | `/orders/:id` | Order detail with progress, drone location & ETA |

### 🤖 Drones
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/drones/jobs/reserve` | Reserve the next open job |
| `POST` | `/drones/jobs/:jobId/grab` | Grab order from origin/broken drone |
| `PATCH` | `/drones/jobs/:jobId/complete` | Mark as delivered or failed |
| `PATCH` | `/drones/status/broken` | Mark broken (triggers handoff job) |
| `PATCH` | `/drones/heartbeat` | Update location & receive status |
| `GET` | `/drones/current-order` | Get currently assigned order details |

### 🛡️ Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/orders` | Bulk list all orders (paginated, filterable) |
| `PATCH` | `/admin/orders/:id/location` | Change origin or destination |
| `GET` | `/admin/drones` | List all drones |
| `PATCH` | `/admin/drones/:id/status` | Mark drone as broken or fixed |

> 📖 Full interactive docs at **http://localhost:3000/api/docs**

---

## 🔄 Order Lifecycle

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
3. A new **HANDOFF** job is created with pickup at the broken drone's location
4. Any other available drone can reserve and complete the handoff
5. Even if the broken drone is fixed, the handoff job remains active

---

## 🧪 Testing

```bash
# Run all 42 E2E tests
npm run test:e2e
```

**Test coverage includes:**
- ✅ JWT generation & validation
- ✅ RBAC guards (cross-role access denied)
- ✅ Full order lifecycle (submit → reserve → grab → deliver)
- ✅ Broken drone handoff flow
- ✅ Order withdrawal (before and after pickup)
- ✅ Admin bulk operations & location updates
- ✅ Edge cases (duplicate reservations, cross-drone grabs, coordinate validation)

---

## 🛠️ Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start the server |
| `npm run start:dev` | Start with hot-reload |
| `npm run test:e2e` | Run E2E test suite |
| `npm run lint` | Lint & auto-fix |
| `npm run format` | Format with Prettier |
| `npm run build` | Build for production |

---

## 📋 Design Decisions

- **SQLite** — Zero-config embedded database, ideal for assessment scope. Swappable to PostgreSQL via TypeORM config.
- **Auto-registration** — Drones are created on first heartbeat/action, no manual setup needed.
- **Transactional operations** — Job reservation and handoff use database transactions to prevent race conditions.
- **ETA calculation** — Uses Haversine distance with estimated drone speed for real-time ETA.
- **Optimistic locking** — Prevents two drones from reserving the same job.

---

## License

MIT
