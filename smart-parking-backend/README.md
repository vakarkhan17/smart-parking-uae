# Smart UAE Parking Backend

Backend with email registration, email verification, login with JWT, profile, vehicles, and bookings.

## Setup

Create PostgreSQL database:

```sql
CREATE DATABASE smart_parking;
```

Run schema:

```powershell
psql -U postgres -d smart_parking -f database/schema.sql
```

Install packages:

```powershell
npm.cmd install
```

Copy environment file:

```powershell
copy .env.example .env
```

Update `.env` with DB password, JWT secret, and SMTP details.

Start backend:

```powershell
npm.cmd run dev
```

Backend runs on:

```text
http://localhost:5000
```

## Endpoints

- POST `/api/auth/register`
- POST `/api/auth/verify-email`
- POST `/api/auth/resend-code`
- POST `/api/auth/login`
- GET `/api/profile/me`
- GET/POST/PUT/DELETE `/api/vehicles`
- GET/POST `/api/bookings`
