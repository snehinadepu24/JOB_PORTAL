# Setup Checklist - Supabase Migration

Follow these steps in order to get your application running with Supabase.

## ☐ Step 1: Install Dependencies

```bash
cd backend
npm install
```

**Expected output:** All packages installed successfully, including `@supabase/supabase-js`

---

## ☐ Step 2: Create Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - Project name: `job-portal` (or your choice)
   - Database password: (save this!)
   - Region: Choose closest to you
5. Wait for project creation (2-3 minutes)

---

## ☐ Step 3: Set Up Database Tables

1. In Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New Query"
3. Open `backend/database/schema.sql` in your code editor
4. Copy ALL the contents
5. Paste into Supabase SQL Editor
6. Click "Run" button
7. You should see "Success. No rows returned"

**Verify:** Go to "Table Editor" - you should see 3 tables: `users`, `jobs`, `applications`

---

## ☐ Step 4: Get Supabase Credentials

1. In Supabase dashboard, go to Settings (gear icon) > API
2. Find and copy these values:

   **Project URL:**
   ```
   Example: https://abcdefghijklmnop.supabase.co
   ```

   **anon/public key:**
   ```
   Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   **service_role key:** (scroll down)
   ```
   Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## ☐ Step 5: Update Environment Variables

1. Open `backend/config/config.env`
2. Replace these three lines:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

With your actual values from Step 4.

**Keep everything else the same** (PORT, CLOUDINARY, JWT, etc.)

---

## ☐ Step 6: Start the Backend Server

```bash
npm start
```

**Expected output:**
```
Supabase Connected Successfully!
Environment Configuration:
PORT: 4000
FRONTEND_URL: http://localhost:5173
SUPABASE_URL: https://your-project.supabase.co
...
Server running at port 4000
```

**If you see errors:**
- "Supabase URL or Key is missing!" → Check Step 5
- "relation 'users' does not exist" → Redo Step 3
- Connection timeout → Check internet connection

---

## ☐ Step 7: Test User Registration

Use Postman, Thunder Client, or curl:

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

**Expected response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "name": "Test User",
    "email": "test@example.com",
    ...
  },
  "message": "User Registered Successfully !",
  "token": "jwt-token-here"
}
```

**Verify in Supabase:**
1. Go to Table Editor > users
2. You should see your test user

---

## ☐ Step 8: Test User Login

```bash
POST http://localhost:4000/api/v1/user/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "role": "Job Seeker"
}
```

**Expected response:**
```json
{
  "success": true,
  "user": { ... },
  "message": "User Logged In Successfully !",
  "token": "jwt-token-here"
}
```

---

## ☐ Step 9: Start Frontend (Optional)

```bash
cd ../frontend
npm install
npm run dev
```

The frontend should work without any changes!

---

## ☐ Step 10: Test Complete Flow

1. Register as Employer
2. Login as Employer
3. Post a job
4. Register as Job Seeker
5. Login as Job Seeker
6. Apply to the job
7. Login as Employer again
8. View applications

---

## Troubleshooting

### Issue: "Cannot find module '@supabase/supabase-js'"
**Solution:** Run `npm install` in the backend folder

### Issue: "relation 'users' does not exist"
**Solution:** Run the schema.sql file in Supabase SQL Editor (Step 3)

### Issue: "Invalid API key"
**Solution:** Double-check your SUPABASE_SERVICE_ROLE_KEY in config.env

### Issue: "User Not Authorized" on protected routes
**Solution:** Make sure you're sending the cookie/token from login response

### Issue: Frontend can't connect
**Solution:** Check FRONTEND_URL in config.env matches your frontend URL

---

## Success Criteria

✅ Backend server starts without errors
✅ Can register a new user
✅ Can login with registered user
✅ Can see user in Supabase Table Editor
✅ All API endpoints respond correctly
✅ Frontend connects and works (if testing)

---

## What's Next?

Once everything is working:

1. **Remove old MongoDB files** (optional):
   - `backend/database/dbConnection.js`
   - `backend/models/` folder

2. **Consider enhancements**:
   - Implement Supabase Auth for authentication
   - Use Supabase Storage for resume uploads
   - Add real-time subscriptions for live updates
   - Implement Row Level Security policies

3. **Deploy**:
   - Backend: Vercel, Railway, or Render
   - Frontend: Vercel or Netlify
   - Database: Already on Supabase!

---

## Need Help?

Check these files:
- `MIGRATION_SUMMARY.md` - Overview of all changes
- `backend/SETUP_INSTRUCTIONS.md` - Quick setup guide
- `backend/MIGRATION_GUIDE.md` - Detailed migration info
- `backend/README.md` - Complete API documentation
