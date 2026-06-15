# Document Management API

REST API for managing PDF documents with JWT authentication and role-based access control. Built with Node.js, Express, PostgreSQL, and Redis.

---

## Features

- User registration and login with JWT
- Role-based access: **Admin**, **Manager**, **Employee**
- PDF upload with file-type and size validation (max 10MB)
- Document listing with pagination and search
- Soft-delete (documents are never permanently removed from the DB)
- Redis caching for list endpoints 
- Local disk storage by default — swap to AWS S3 with one env var
- Docker + Docker Compose setup (app + Postgres + Redis, zero manual config)

---

## Quick Start (Docker) , If docker is installed on system

The easiest way to run everything:

```bash
git clone <your-repo-url>
cd symfor-assessment
docker compose up --build
```

The API will be available at `http://localhost:8080`. The database schema is applied automatically on first run.

---

## Manual Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional — caching silently disabled if unavailable)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and secrets. At minimum:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=some_long_random_string
```

### 3. Create the database

```bash
createdb docmanager
```

### 4. Run migrations

```bash
npm run migrate
```

Or run the SQL manually:

```bash
psql -U postgres -d docmanager -f migrations/001_init.sql
```

### 5. Start the server

```bash
# development (auto-restart on changes)
npm run dev

# production
npm start
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | Server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `DATABASE_URL` | Yes | — | Connection string (e.g. `postgresql://...`) |
| `JWT_SECRET` | Yes | — | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL |
| `STORAGE` | No | `local` | `local` or `s3` |
| `UPLOAD_DIR` | No | `uploads` | Local upload directory |
| `AWS_REGION` | If S3 | — | AWS region |
| `AWS_ACCESS_KEY_ID` | If S3 | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | If S3 | — | AWS secret key |
| `S3_BUCKET` | If S3 | — | S3 bucket name |
| `REDIS_URL` | No | — | Redis connection URL |

---

## API Reference

All endpoints live under `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/api/auth/register` | No | `{ name, email, password, role? }` |
| POST | `/api/auth/login` | No | `{ email, password }` |
| POST | `/api/auth/refresh` | No | `{ refreshToken }` |
| POST | `/api/auth/logout` | No | `{ refreshToken }` |
| GET | `/api/auth/me` | Yes | — |

**Roles:** `admin`, `manager`, `employee` (default: `employee`)

#### Register example

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "Password123", "role": "admin"}'
```

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/2411ff10-51f6-410b-844c-87e95e1d48e8" />


#### Login example

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "Password123"}'
```

Response:
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "user": { "id": "...", "name": "Alice", "email": "alice@example.com", "role": "admin" }
}
```
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/fbc45495-997a-4dbc-bc91-e0cf194a912b" />

#### Refresh Token example

```bash
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "abc123..."}'
```

Response:
```json
{
  "success": true,
  "accessToken": "new_eyJ...",
  "refreshToken": "new_abc123..."
}
```

#### Logout example

```bash
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "abc123..."}'
```

Response:
```json
{
  "success": true,
  "message": "Logged out"
}
```

#### Get Current User (Me) example

```bash
curl -X GET http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "...",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "admin",
    "created_at": "..."
  }
}
```

---

### Documents

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/documents` | Yes | All | List documents |
| POST | `/api/documents/upload` | Yes | Admin, Manager | Upload PDF |
| DELETE | `/api/documents/:id` | Yes | Admin | Soft-delete document |

#### List query params

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `10` | Items per page (max 100) |
| `search` | — | Case-insensitive title search |

#### List Documents example

```bash
curl -X GET "http://localhost:8080/api/documents?page=1&limit=10&search=report" \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 2, "limit": 5, "total": 23, "pages": 5 }
}
```

#### Upload example

```bash
curl -X POST http://localhost:8080/api/documents/upload \
  -H "Authorization: Bearer <token>" \
  -F "title=Q4 Report" \
  -F "file=@/path/to/report.pdf"
```

#### Delete Document example

```bash
curl -X DELETE http://localhost:8080/api/documents/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "success": true,
  "message": "Document deleted"
}
```

---

## Database Schema

```
users
  id            UUID PK
  name          VARCHAR(120)
  email         VARCHAR(255) UNIQUE
  password_hash TEXT
  role          VARCHAR(20)  -- admin | manager | employee
  created_at    TIMESTAMPTZ

documents
  id            UUID PK
  title         VARCHAR(255)
  filename      VARCHAR(255)  -- original filename
  filepath      TEXT          -- local path or S3 key
  mime_type     VARCHAR(100)
  size          INTEGER       -- bytes
  uploaded_by   UUID FK → users
  is_deleted    BOOLEAN       -- soft delete
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ


```

---

## S3 Storage

To use AWS S3 instead of local disk:

```env
STORAGE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=your-bucket-name
```



---

## Postman Collection

Import `postman/DocManagement.json` into Postman. The collection uses variables (`baseUrl`, `accessToken`, `documentId`) — the Login and Upload requests auto-set these via test scripts so you can run requests in sequence without copy-pasting tokens.

---

## Project Structure

```
symfor-assessment/
├── src/
│   ├── config/
│   │   ├── db.js           pg connection pool
│   │   ├── redis.js        ioredis with graceful fallback
│   │   └── s3.js           AWS S3 helpers
│   ├── middleware/
│   │   ├── auth.js         JWT verification
│   │   ├── roles.js        requireRole(...roles)
│   │   └── validate.js     express-validator error handler
│   ├── routes/
│   │   ├── auth.js
│   │   └── documents.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── documentController.js
│   ├── services/
│   │   ├── userService.js
│   │   └── documentService.js
│   └── utils/
│       └── errors.js
├── migrations/
│   ├── 001_init.sql        full schema
│   └── run.js              migration runner
├── postman/
│   └── DocManagement.json
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── server.js
```
