# Job Portal Backend - Supabase Edition

A Node.js/Express backend for a job portal application using Supabase (PostgreSQL) as the database.

## Features

- User authentication (Job Seekers & Employers)
- Job posting and management
- Job application system
- Resume upload with Cloudinary
- JWT-based authentication
- Role-based access control

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + bcrypt
- **File Upload**: Cloudinary
- **Validation**: Validator.js

## Prerequisites

- Node.js (v14 or higher)
- Supabase account
- Cloudinary account

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your Supabase database:
   - Create a new project on Supabase
   - Run the SQL script in `database/schema.sql` in your Supabase SQL Editor

3. Configure environment variables in `config/config.env`:
```env
PORT=4000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:5173
JWT_SECRET_KEY=your_secret_key
JWT_EXPIRE=7d
COOKIE_EXPIRE=3
```

4. Start the server:
```bash
npm start
# or for development
npm run dev
```

## API Endpoints

### User Routes
- `POST /api/v1/user/register` - Register new user
- `POST /api/v1/user/login` - User login
- `GET /api/v1/user/logout` - User logout
- `GET /api/v1/user/getuser` - Get current user
- `POST /api/v1/user/forgot-password` - Forgot password
- `POST /api/v1/user/reset-password` - Reset password

### Job Routes
- `GET /api/v1/job/getall` - Get all active jobs
- `POST /api/v1/job/post` - Post a new job (Employer only)
- `GET /api/v1/job/getmyjobs` - Get employer's jobs
- `PUT /api/v1/job/update/:id` - Update a job
- `DELETE /api/v1/job/delete/:id` - Delete a job
- `GET /api/v1/job/:id` - Get single job details

### Application Routes
- `POST /api/v1/application/post` - Submit job application (Job Seeker only)
- `GET /api/v1/application/employer/getall` - Get all applications for employer
- `GET /api/v1/application/jobseeker/getall` - Get all applications by job seeker
- `DELETE /api/v1/application/delete/:id` - Delete application
- `PUT /api/v1/application/update/:id` - Update application status (Employer only)

## Database Schema

### Users Table
- id (UUID, Primary Key)
- name (VARCHAR)
- email (VARCHAR, Unique)
- phone (BIGINT)
- password (VARCHAR, hashed)
- role (ENUM: 'Job Seeker', 'Employer')
- favourite_sport (VARCHAR)
- created_at (TIMESTAMP)

### Jobs Table
- id (UUID, Primary Key)
- title (VARCHAR)
- description (VARCHAR)
- category (VARCHAR)
- country (VARCHAR)
- city (VARCHAR)
- location (VARCHAR)
- fixed_salary (INTEGER)
- salary_from (INTEGER)
- salary_to (INTEGER)
- expired (BOOLEAN)
- job_posted_on (TIMESTAMP)
- posted_by (UUID, Foreign Key → users.id)

### Applications Table
- id (UUID, Primary Key)
- name (VARCHAR)
- email (VARCHAR)
- cover_letter (TEXT)
- phone (BIGINT)
- address (TEXT)
- status (ENUM: 'pending', 'accepted', 'rejected')
- resume_public_id (VARCHAR)
- resume_url (TEXT)
- applicant_id (UUID, Foreign Key → users.id)
- applicant_role (VARCHAR)
- employer_id (UUID, Foreign Key → users.id)
- employer_role (VARCHAR)
- created_at (TIMESTAMP)

## Migration from MongoDB

This project was migrated from MongoDB to Supabase. See `MIGRATION_GUIDE.md` for detailed migration instructions.

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- HTTP-only cookies
- Role-based access control
- Input validation
- SQL injection prevention (via Supabase client)

## Error Handling

The application uses centralized error handling with custom error classes and async error catching middleware.

## License

ISC
