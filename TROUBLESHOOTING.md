# Troubleshooting Guide

Common issues and solutions for the Supabase migration.

## Installation Issues

### Issue: "Cannot find module '@supabase/supabase-js'"

**Cause:** Dependencies not installed

**Solution:**
```bash
cd backend
npm install
```

---

### Issue: "npm ERR! peer dependency"

**Cause:** Version conflicts

**Solution:**
```bash
npm install --legacy-peer-deps
```

---

## Database Connection Issues

### Issue: "Supabase URL or Key is missing!"

**Cause:** Environment variables not set

**Solution:**
1. Check `backend/config/config.env` exists
2. Verify these variables are set:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-key-here
   ```
3. Make sure there are no extra spaces or quotes

---

### Issue: "relation 'users' does not exist"

**Cause:** Database tables not created

**Solution:**
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Copy contents of `backend/database/schema.sql`
4. Paste and click "Run"
5. Verify tables exist in "Table Editor"

---

### Issue: "Connection timeout" or "Network error"

**Cause:** Network or firewall issues

**Solution:**
1. Check your internet connection
2. Verify SUPABASE_URL is correct
3. Try accessing your Supabase dashboard in browser
4. Check if VPN is blocking connection
5. Verify Supabase project is not paused

---

## Authentication Issues

### Issue: "User Not Authorized" on protected routes

**Cause:** Token not being sent or invalid

**Solution:**
1. Make sure you're logged in first
2. Check if cookie is being sent with requests
3. Verify JWT_SECRET_KEY matches between login and verification
4. Check token hasn't expired (JWT_EXPIRE setting)

**Test:**
```bash
# Login first
POST http://localhost:4000/api/v1/user/login
# Save the token from response

# Then use it in subsequent requests
GET http://localhost:4000/api/v1/user/getuser
Cookie: token=your-token-here
```

---

### Issue: "Invalid Email Or Password"

**Cause:** Wrong credentials or user doesn't exist

**Solution:**
1. Verify email is correct
2. Check password is correct
3. Verify user exists in Supabase Table Editor
4. Make sure role matches (Job Seeker vs Employer)

---

### Issue: "Invalid or Expired Token"

**Cause:** Token expired or JWT_SECRET_KEY changed

**Solution:**
1. Login again to get new token
2. Verify JWT_SECRET_KEY hasn't changed
3. Check JWT_EXPIRE setting in config.env

---

## API Request Issues

### Issue: "CORS error" in browser console

**Cause:** Frontend URL not whitelisted

**Solution:**
1. Check FRONTEND_URL in `backend/config/config.env`
2. Make sure it matches your frontend URL exactly
3. Include protocol (http:// or https://)
4. No trailing slash

Example:
```env
FRONTEND_URL=http://localhost:5173
```

---

### Issue: "Cannot POST /api/v1/..." or 404 errors

**Cause:** Wrong endpoint or server not running

**Solution:**
1. Verify backend server is running
2. Check endpoint URL is correct
3. Verify HTTP method (GET, POST, PUT, DELETE)
4. Check route files are imported in app.js

---

### Issue: "Please fill full form" or validation errors

**Cause:** Missing required fields

**Solution:**
Check all required fields are provided:

**Register:**
- name, email, phone, password, role, favouriteSport

**Login:**
- email, password, role

**Post Job:**
- title, description, category, country, city, location
- Either fixedSalary OR (salaryFrom AND salaryTo)

**Apply:**
- name, email, coverLetter, phone, address, jobId, resume file

---

## Database Query Issues

### Issue: "Invalid UUID" or "CastError"

**Cause:** Invalid ID format

**Solution:**
1. Supabase uses UUIDs, not MongoDB ObjectIds
2. UUIDs look like: `550e8400-e29b-41d4-a716-446655440000`
3. Make sure you're using the correct ID from Supabase

---

### Issue: "Foreign key violation"

**Cause:** Referenced record doesn't exist

**Solution:**
1. Verify the user/job exists before creating related records
2. Check IDs are correct
3. Don't delete users that have related jobs/applications

---

### Issue: "Duplicate key value violates unique constraint"

**Cause:** Trying to insert duplicate email

**Solution:**
1. Email must be unique
2. Check if user already exists
3. Use different email for new registration

---

## File Upload Issues

### Issue: "Resume File Required!"

**Cause:** File not uploaded or wrong field name

**Solution:**
1. Make sure file input name is "resume"
2. File must be included in form-data
3. Check file is actually selected

---

### Issue: "Invalid file type. Please upload a PDF file."

**Cause:** Wrong file format

**Solution:**
1. Only PDF files are allowed
2. Check file extension is .pdf
3. Verify MIME type is application/pdf

---

### Issue: Cloudinary upload fails

**Cause:** Invalid Cloudinary credentials

**Solution:**
1. Verify Cloudinary credentials in config.env:
   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```
2. Check credentials in Cloudinary dashboard
3. Verify account is active

---

## Role-Based Access Issues

### Issue: "Job Seeker not allowed to access this resource"

**Cause:** Job Seeker trying to access Employer-only route

**Solution:**
- Job Seekers can: apply to jobs, view applications
- Job Seekers cannot: post jobs, view all applications

Login as Employer to access these features.

---

### Issue: "Employer not allowed to access this resource"

**Cause:** Employer trying to access Job Seeker-only route

**Solution:**
- Employers can: post jobs, view applications for their jobs
- Employers cannot: apply to jobs

Login as Job Seeker to apply to jobs.

---

## Data Migration Issues

### Issue: Old MongoDB data needs to be migrated

**Solution:**
You'll need to export from MongoDB and import to Supabase:

1. **Export from MongoDB:**
```bash
mongoexport --uri="your-mongodb-uri" --collection=users --out=users.json
mongoexport --uri="your-mongodb-uri" --collection=jobs --out=jobs.json
mongoexport --uri="your-mongodb-uri" --collection=applications --out=applications.json
```

2. **Transform data:**
- Convert ObjectIds to UUIDs
- Change field names (camelCase → snake_case)
- Hash passwords if needed

3. **Import to Supabase:**
Use Supabase SQL Editor or CSV import feature

---

## Performance Issues

### Issue: Slow query responses

**Solution:**
1. Check database indexes are created (run schema.sql)
2. Verify Supabase project region is close to you
3. Check network latency
4. Review query complexity

---

### Issue: "Too many connections"

**Solution:**
1. Supabase handles connection pooling automatically
2. Check for connection leaks in code
3. Upgrade Supabase plan if needed

---

## Development Issues

### Issue: Changes not reflecting

**Solution:**
1. Restart the server: `npm start`
2. Clear browser cache
3. Check if you're editing the right file
4. Verify file is saved

---

### Issue: "Port 4000 already in use"

**Solution:**
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Or change port in config.env
PORT=4001
```

---

## Testing Issues

### Issue: Can't test with Postman/Thunder Client

**Solution:**
1. Make sure server is running
2. Use correct URL: `http://localhost:4000`
3. Set Content-Type header: `application/json`
4. For protected routes, include cookie from login

---

### Issue: Frontend can't connect to backend

**Solution:**
1. Verify backend is running on correct port
2. Check FRONTEND_URL in backend config.env
3. Verify CORS is configured correctly
4. Check frontend API base URL

---

## Supabase Dashboard Issues

### Issue: Can't see tables in Table Editor

**Solution:**
1. Make sure schema.sql was run successfully
2. Refresh the page
3. Check "public" schema is selected
4. Verify SQL ran without errors

---

### Issue: Can't access Supabase dashboard

**Solution:**
1. Check internet connection
2. Verify you're logged in
3. Check if project is paused (free tier)
4. Try different browser

---

## Environment Variable Issues

### Issue: "Cannot read property of undefined"

**Cause:** Environment variables not loaded

**Solution:**
1. Verify config.env file exists in `backend/config/`
2. Check dotenv is configured correctly in app.js
3. Restart server after changing .env
4. Check for typos in variable names

---

## Common Error Messages

### "Please provide email, password and role"
- Missing required login fields
- Send all three: email, password, role

### "Email already registered"
- User with this email exists
- Use different email or login instead

### "Job not found"
- Invalid job ID
- Job may have been deleted
- Check ID is correct UUID

### "Application not found"
- Invalid application ID
- Application may have been deleted
- Verify ID is correct

### "Cannot delete application after it has been processed"
- Application status is not "pending"
- Only pending applications can be deleted

### "Not authorized to update this application"
- Trying to update someone else's application
- Verify you're logged in as correct employer

---

## Getting Help

If you're still stuck:

1. **Check logs:**
   - Backend console output
   - Supabase logs in dashboard
   - Browser console (F12)

2. **Verify setup:**
   - Run through SETUP_CHECKLIST.md again
   - Check all environment variables
   - Verify database tables exist

3. **Review documentation:**
   - README.md - API documentation
   - MIGRATION_GUIDE.md - Migration details
   - ARCHITECTURE.md - System overview

4. **Test systematically:**
   - Test one endpoint at a time
   - Start with user registration
   - Then login, then other features

5. **Check examples:**
   - COMPARISON.md - Code examples
   - SETUP_INSTRUCTIONS.md - Step-by-step guide
