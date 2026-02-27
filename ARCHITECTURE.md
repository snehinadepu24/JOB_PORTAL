# Job Portal Architecture - Supabase Edition

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Home   │  │   Jobs   │  │   Auth   │  │  Apply   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│                    HTTP Requests (Axios)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ REST API Calls
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    BACKEND (Express.js)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Middleware Layer                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │   CORS   │  │   Auth   │  │  Error   │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Controllers Layer                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐          │  │
│  │  │   User   │  │   Job    │  │ Application  │          │  │
│  │  └──────────┘  └──────────┘  └──────────────┘          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Utilities Layer                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │   JWT    │  │ Password │  │  Token   │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
┌───────────────────────────┐  ┌──────────────────────┐
│   SUPABASE (PostgreSQL)   │  │  CLOUDINARY (Files)  │
│                           │  │                      │
│  ┌─────────────────────┐ │  │  ┌────────────────┐ │
│  │   users table       │ │  │  │    Resumes     │ │
│  │   - id (UUID)       │ │  │  │    (PDFs)      │ │
│  │   - name            │ │  │  └────────────────┘ │
│  │   - email           │ │  │                      │
│  │   - password        │ │  └──────────────────────┘
│  │   - role            │ │
│  └─────────────────────┘ │
│                           │
│  ┌─────────────────────┐ │
│  │   jobs table        │ │
│  │   - id (UUID)       │ │
│  │   - title           │ │
│  │   - description     │ │
│  │   - posted_by (FK)  │ │
│  └─────────────────────┘ │
│                           │
│  ┌─────────────────────┐ │
│  │ applications table  │ │
│  │   - id (UUID)       │ │
│  │   - applicant_id    │ │
│  │   - employer_id     │ │
│  │   - resume_url      │ │
│  │   - status          │ │
│  └─────────────────────┘ │
│                           │
└───────────────────────────┘
```

## Data Flow

### 1. User Registration Flow
```
User Input (Frontend)
    │
    ▼
POST /api/v1/user/register
    │
    ▼
userController.register()
    │
    ├─► Validate input
    ├─► Check email exists (Supabase query)
    ├─► Hash password (bcrypt)
    ├─► Insert user (Supabase)
    └─► Generate JWT token
    │
    ▼
Response with token & user data
    │
    ▼
Frontend stores token in cookies
```

### 2. Job Application Flow
```
User uploads resume (Frontend)
    │
    ▼
POST /api/v1/application/post
    │
    ▼
applicationController.postApplication()
    │
    ├─► Validate user role (Job Seeker)
    ├─► Upload resume to Cloudinary
    ├─► Get job details (Supabase query)
    ├─► Create application record (Supabase)
    └─► Return success response
    │
    ▼
Application stored in database
Resume stored in Cloudinary
```

### 3. Authentication Flow
```
User login request
    │
    ▼
POST /api/v1/user/login
    │
    ▼
userController.login()
    │
    ├─► Find user by email (Supabase)
    ├─► Compare password (bcrypt)
    ├─► Verify role matches
    └─► Generate JWT token
    │
    ▼
Token sent in HTTP-only cookie
    │
    ▼
Subsequent requests include token
    │
    ▼
isAuthenticated middleware
    │
    ├─► Extract token from cookie
    ├─► Verify JWT signature
    ├─► Fetch user from Supabase
    └─► Attach user to req.user
    │
    ▼
Protected route handler executes
```

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────┐
│        users            │
│─────────────────────────│
│ id (PK, UUID)           │
│ name                    │
│ email (UNIQUE)          │
│ phone                   │
│ password                │
│ role                    │
│ favourite_sport         │
│ created_at              │
└───────────┬─────────────┘
            │
            │ 1:N
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│        jobs             │    │    applications         │
│─────────────────────────│    │─────────────────────────│
│ id (PK, UUID)           │    │ id (PK, UUID)           │
│ title                   │    │ name                    │
│ description             │    │ email                   │
│ category                │    │ cover_letter            │
│ country                 │    │ phone                   │
│ city                    │    │ address                 │
│ location                │    │ status                  │
│ fixed_salary            │    │ resume_public_id        │
│ salary_from             │    │ resume_url              │
│ salary_to               │    │ applicant_id (FK)       │
│ expired                 │    │ applicant_role          │
│ job_posted_on           │    │ employer_id (FK)        │
│ posted_by (FK)          │◄───┤ employer_role           │
└─────────────────────────┘    │ created_at              │
                               └─────────────────────────┘
```

### Relationships

1. **users → jobs** (1:N)
   - One user (Employer) can post many jobs
   - `jobs.posted_by` references `users.id`

2. **users → applications** (1:N as applicant)
   - One user (Job Seeker) can submit many applications
   - `applications.applicant_id` references `users.id`

3. **users → applications** (1:N as employer)
   - One user (Employer) can receive many applications
   - `applications.employer_id` references `users.id`

## API Endpoints

### User Endpoints
```
POST   /api/v1/user/register          - Register new user
POST   /api/v1/user/login             - Login user
GET    /api/v1/user/logout            - Logout user
GET    /api/v1/user/getuser           - Get current user (protected)
POST   /api/v1/user/forgot-password   - Forgot password
POST   /api/v1/user/reset-password    - Reset password
```

### Job Endpoints
```
GET    /api/v1/job/getall             - Get all active jobs
POST   /api/v1/job/post               - Post new job (Employer only)
GET    /api/v1/job/getmyjobs          - Get employer's jobs (protected)
PUT    /api/v1/job/update/:id         - Update job (protected)
DELETE /api/v1/job/delete/:id         - Delete job (protected)
GET    /api/v1/job/:id                - Get single job details
```

### Application Endpoints
```
POST   /api/v1/application/post                    - Submit application (Job Seeker)
GET    /api/v1/application/employer/getall         - Get employer's applications
GET    /api/v1/application/jobseeker/getall        - Get job seeker's applications
DELETE /api/v1/application/delete/:id              - Delete application
PUT    /api/v1/application/update/:id              - Update application status (Employer)
```

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. CORS Protection                                      │
│     └─► Only allows requests from FRONTEND_URL          │
│                                                          │
│  2. JWT Authentication                                   │
│     └─► Verifies token signature and expiration         │
│                                                          │
│  3. HTTP-Only Cookies                                    │
│     └─► Prevents XSS attacks on tokens                  │
│                                                          │
│  4. Password Hashing (bcrypt)                            │
│     └─► Passwords never stored in plain text            │
│                                                          │
│  5. Role-Based Access Control                            │
│     └─► Employers can't apply, Job Seekers can't post   │
│                                                          │
│  6. Input Validation                                     │
│     └─► Validates email, length, required fields        │
│                                                          │
│  7. SQL Injection Prevention                             │
│     └─► Supabase client uses parameterized queries      │
│                                                          │
│  8. Database Constraints                                 │
│     └─► Foreign keys, unique constraints, checks        │
│                                                          │
│  9. Row Level Security (RLS)                             │
│     └─► Can be enabled for fine-grained access          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js v4.18.2
- **Database**: Supabase (PostgreSQL)
- **ORM**: @supabase/supabase-js v2.39.0
- **Authentication**: jsonwebtoken v9.0.2
- **Password Hashing**: bcrypt v5.1.1
- **File Upload**: express-fileupload v1.4.3
- **Validation**: validator v13.11.0

### Frontend
- **Framework**: React (Vite)
- **HTTP Client**: Axios
- **Routing**: React Router
- **State Management**: Context API

### External Services
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Cloudinary
- **Authentication**: Custom JWT

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Setup                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (Vercel/Netlify)                              │
│      │                                                   │
│      │ HTTPS                                             │
│      ▼                                                   │
│  Backend (Vercel/Railway/Render)                        │
│      │                                                   │
│      ├──► Supabase (Database)                           │
│      │                                                   │
│      └──► Cloudinary (File Storage)                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Performance Optimizations

1. **Database Indexes**
   - Email index on users table
   - Foreign key indexes on all relationships
   - Status index on applications

2. **Query Optimization**
   - Select only needed columns
   - Use single() for single record queries
   - Order results at database level

3. **Connection Pooling**
   - Supabase handles connection pooling automatically
   - No need for manual connection management

4. **Caching Opportunities**
   - Job listings (can be cached for 5 minutes)
   - User profile data (can be cached per session)

## Monitoring & Logging

```
Backend Logs:
  ├─► Server startup logs
  ├─► Database connection status
  ├─► API request logs
  └─► Error logs

Supabase Dashboard:
  ├─► Query performance
  ├─► Database size
  ├─► Active connections
  └─► Error logs

Cloudinary Dashboard:
  ├─► Storage usage
  ├─► Upload statistics
  └─► Bandwidth usage
```

## Future Enhancements

1. **Real-time Features**
   - Live job updates using Supabase subscriptions
   - Real-time application status notifications

2. **Advanced Search**
   - Full-text search on job descriptions
   - Filters by salary, location, category

3. **Email Notifications**
   - Application confirmation emails
   - Status update notifications

4. **Analytics**
   - Job view tracking
   - Application conversion rates
   - User engagement metrics

5. **Enhanced Security**
   - Two-factor authentication
   - Rate limiting
   - IP whitelisting for admin routes
