# MongoDB to Supabase Migration Guide

## Overview
This application has been migrated from MongoDB to Supabase (PostgreSQL). This guide will help you set up and run the application with Supabase.

## Prerequisites
1. A Supabase account (sign up at https://supabase.com)
2. Node.js installed on your system
3. Cloudinary account for file uploads

## Setup Steps

### 1. Create a Supabase Project
1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in your project details
4. Wait for the project to be created

### 2. Set Up Database Tables
1. In your Supabase dashboard, go to the SQL Editor
2. Copy the contents of `backend/database/schema.sql`
3. Paste it into the SQL Editor and run it
4. This will create all necessary tables with proper constraints and indexes

### 3. Get Your Supabase Credentials
1. In your Supabase dashboard, go to Settings > API
2. Copy the following:
   - Project URL (SUPABASE_URL)
   - anon/public key (SUPABASE_ANON_KEY)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY)

### 4. Update Environment Variables
Edit `backend/config/config.env` and update:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Keep all other variables (PORT, CLOUDINARY, JWT, etc.) as they are.

### 5. Install Dependencies
```bash
cd backend
npm install
```

This will install the new `@supabase/supabase-js` package and remove mongoose.

### 6. Run the Application
```bash
npm start
# or for development
npm run dev
```

## Key Changes

### Database Structure
- **MongoDB Collections** → **PostgreSQL Tables**
  - `users` collection → `users` table
  - `jobs` collection → `jobs` table
  - `applications` collection → `applications` table

### Field Name Changes (MongoDB → Supabase)
- `_id` → `id` (UUID instead of ObjectId)
- `favouriteSport` → `favourite_sport`
- `fixedSalary` → `fixed_salary`
- `salaryFrom` → `salary_from`
- `salaryTo` → `salary_to`
- `jobPostedOn` → `job_posted_on`
- `postedBy` → `posted_by`
- `coverLetter` → `cover_letter`
- `applicantID` → `applicant_id` / `applicant_role`
- `employerID` → `employer_id` / `employer_role`
- `resume.public_id` → `resume_public_id`
- `resume.url` → `resume_url`
- `createdAt` → `created_at`

### Authentication
- JWT-based authentication is maintained
- Password hashing with bcrypt is still used
- Tokens are stored in HTTP-only cookies

### File Structure Changes
- `database/dbConnection.js` → `database/supabaseClient.js`
- Removed: `models/` folder (no longer needed with Supabase)
- Added: `utils/passwordUtils.js` - Password hashing utilities
- Added: `utils/tokenUtils.js` - JWT token utilities
- Added: `database/schema.sql` - Database schema definition

## Testing the Migration

### 1. Test User Registration
```bash
POST http://localhost:4000/api/v1/user/register
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "Job Seeker",
  "favouriteSport": "Football"
}
```

### 2. Test User Login
```bash
POST http://localhost:4000/api/v1/user/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "role": "Job Seeker"
}
```

### 3. Verify in Supabase Dashboard
1. Go to your Supabase dashboard
2. Navigate to Table Editor
3. Check the `users` table to see the registered user

## Troubleshooting

### Connection Issues
- Verify your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- Check if your IP is allowed in Supabase (Settings > Database > Connection Pooling)

### Migration Errors
- Ensure all tables are created by running the schema.sql file
- Check Supabase logs in the dashboard for detailed error messages

### Authentication Issues
- Verify JWT_SECRET_KEY is set in config.env
- Check cookie settings if running on different domains

## Benefits of Supabase

1. **Real-time capabilities** - Built-in real-time subscriptions
2. **Better performance** - PostgreSQL is highly optimized
3. **Built-in auth** - Optional Supabase Auth integration
4. **Row Level Security** - Fine-grained access control
5. **Auto-generated APIs** - REST and GraphQL APIs
6. **Better querying** - SQL power with JavaScript simplicity
7. **Free tier** - Generous free tier for development

## Next Steps

Consider implementing:
1. Supabase Auth for authentication (instead of custom JWT)
2. Real-time subscriptions for live job updates
3. Row Level Security policies for better security
4. Supabase Storage for resume uploads (instead of Cloudinary)
5. Database functions for complex queries
