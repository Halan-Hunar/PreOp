# PreOp — Pre-Operative Assessment System

A full-stack web application for managing pre-surgery patient assessments in an ENT clinic. Built for the Software Construction course (SCSJ4383/SCJ4383).

## Features

- **Authentication** — JWT-based login with session management, rate limiting, and activity logs
- **Patient Management** — Add, edit, search, and soft-delete patients with full profile history
- **Appointment Scheduling** — Calendar view with role-scoped access
- **Pre-op Assessment Form** — Digital version of the Pre-Anesthesia Evaluation Form with PDF/Excel/Image/Print export
- **User & Staff Management** — Admin panel for managing accounts and roles (admin, receptionist, anaesthetist)
- **Dark Mode & Kurdish Language** — Full Sorani Kurdish (RTL) support and dark/light theme toggle

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS  
**Backend:** Node.js, Express.js  
**Database:** MySQL  
**Auth:** JWT + bcrypt + DB-backed session revocation

## Setup

### Prerequisites
- Node.js v18+
- MySQL 8+

### 1. Clone the repo
```bash
git clone https://github.com/Halan-Hunar/PreOp.git
cd PreOp
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your DB credentials and JWT secret in .env
```

### 3. Set up the database
Create a MySQL database named `preop_db` and run the migration scripts.

### 4. Install dependencies and run

**Backend:**
```bash
cd server
npm install
npm run dev
```

**Frontend (new terminal):**
```bash
cd client
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:5000`.

## REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate user, return JWT |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/patients` | List patients (role-scoped) |
| POST | `/api/patients` | Create new patient |
| GET | `/api/appointments` | List appointments |
| POST | `/api/appointments` | Create appointment |
| GET | `/api/assessments/:patientId` | Get patient assessment |
| POST | `/api/assessments` | Submit assessment |

## Security

- Passwords hashed with bcrypt (cost 12)
- Session tokens stored as SHA-256 hashes
- Role-based access control on all routes
- Rate limiting on login and general API
- Helmet.js security headers
- Parameterized queries (no SQL injection)
- `.env` never committed to version control
