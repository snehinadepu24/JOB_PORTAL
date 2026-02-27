# Quick Setup Instructions

## Step 1: Install Dependencies
```bash
cd backend
npm install
```

## Step 2: Set Up Supabase

1. **Create a Supabase account** at https://supabase.com
2. **Create a new project**
3. **Run the database schema**:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the entire contents of `database/schema.sql`
   - Click "Run" to create all tables

## Step 3: Configure Environment Variables

Edit `config/config.env` and update these values:

```env
# Get these from Supabase Dashboard > Settings > API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Keep your existing Cloudinary credentials
CLOUDINARY_CLOUD_NAME=do1qalgsh
CLOUDINARY_API_KEY=425593635121358
CLOUDINARY_API_SECRET=wgmxWnhi4T0nS_swHfkWx9YOKIY

# Other settings (can keep as is)
PORT=4000
FRONTEND_URL=http://localhost:5173
JWT_SECRET_KEY=random@123
JWT_EXPIRE=7d
COOKIE_EXPIRE=3
```

## Step 4: Start the Server

```bash
npm start
```

You should see:
```
Supabase Connected Successfully!
Server running at port 4000
```

## Step 5: Test the API

Use Postman or any API client to test:

**Register a user:**
```
POST http://localhost:4000/api/v1/user/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "Job Seeker",
  "favouriteSport": "Football"
}
```

**Login:**
```
POST http://localhost:4000/api/v1/user/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123",
  "role": "Job Seeker"
}
```

## Troubleshooting

**"Supabase URL or Key is missing!"**
- Make sure you've updated the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in config.env

**"relation 'users' does not exist"**
- You need to run the schema.sql file in Supabase SQL Editor

**Connection timeout**
- Check your internet connection
- Verify the Supabase URL is correct
- Check if your IP is allowed in Supabase settings

## What Changed from MongoDB?

- Replaced `mongoose` with `@supabase/supabase-js`
- Database queries now use Supabase client instead of Mongoose models
- Field names changed to snake_case (e.g., `favouriteSport` → `favourite_sport`)
- IDs are now UUIDs instead of MongoDB ObjectIds
- All functionality remains the same!

## Need Help?

Check the detailed `MIGRATION_GUIDE.md` for more information.
