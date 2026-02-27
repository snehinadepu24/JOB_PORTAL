# Quick Reference Card

## 🔧 Setup Commands

```bash
# Install dependencies
cd backend
npm install

# Start server
npm start

# Start frontend
cd frontend
npm run dev
```

## 🔑 Environment Variables (config.env)

```env
# Supabase (NEW - Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server
PORT=4000
FRONTEND_URL=http://localhost:5173

# Cloudinary (Keep existing)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# JWT (Keep existing)
JWT_SECRET_KEY=random@123
JWT_EXPIRE=7d
COOKIE_EXPIRE=3
```

## 📊 Database Tables

```sql
users           → User accounts
jobs            → Job postings
applications    → Job applications
```

## 🔄 Field Name Changes

| MongoDB | Supabase |
|---------|----------|
| `_id` | `id` |
| `favouriteSport` | `favourite_sport` |
| `fixedSalary` | `fixed_salary` |
| `salaryFrom` | `salary_from` |
| `salaryTo` | `salary_to` |
| `jobPostedOn` | `job_posted_on` |
| `postedBy` | `posted_by` |
| `coverLetter` | `cover_letter` |
| `applicantID.user` | `applicant_id` |
| `employerID.user` | `employer_id` |
| `resume.url` | `resume_url` |
| `createdAt` | `created_at` |

## 🌐 API Endpoints

### User
```
POST   /api/v1/user/register
POST   /api/v1/user/login
GET    /api/v1/user/logout
GET    /api/v1/user/getuser
POST   /api/v1/user/forgot-password
POST   /api/v1/user/reset-password
```

### Job
```
GET    /api/v1/job/getall
POST   /api/v1/job/post
GET    /api/v1/job/getmyjobs
PUT    /api/v1/job/update/:id
DELETE /api/v1/job/delete/:id
GET    /api/v1/job/:id
```

### Application
```
POST   /api/v1/application/post
GET    /api/v1/application/employer/getall
GET    /api/v1/application/jobseeker/getall
DELETE /api/v1/application/delete/:id
PUT    /api/v1/application/update/:id
```

## 🧪 Test Requests

### Register
```json
POST /api/v1/user/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "Job Seeker",
  "favouriteSport": "Football"
}
```

### Login
```json
POST /api/v1/user/login
{
  "email": "john@example.com",
  "password": "password123",
  "role": "Job Seeker"
}
```

### Post Job (Employer only)
```json
POST /api/v1/job/post
{
  "title": "Software Developer",
  "description": "We are looking for a skilled developer...",
  "category": "IT",
  "country": "USA",
  "city": "New York",
  "location": "123 Main St, New York, NY",
  "fixedSalary": 80000
}
```

## 🔍 Supabase Queries (Code Reference)

### Find One
```javascript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
  .single();
```

### Find Many
```javascript
const { data, error } = await supabase
  .from('jobs')
  .select('*')
  .eq('expired', false);
```

### Insert
```javascript
const { data, error } = await supabase
  .from('users')
  .insert([{ name, email, password }])
  .select()
  .single();
```

### Update
```javascript
const { error } = await supabase
  .from('jobs')
  .update({ title: 'New Title' })
  .eq('id', jobId);
```

### Delete
```javascript
const { error } = await supabase
  .from('applications')
  .delete()
  .eq('id', applicationId);
```

## 🚨 Common Errors

| Error | Solution |
|-------|----------|
| "Supabase URL or Key is missing" | Check config.env |
| "relation 'users' does not exist" | Run schema.sql |
| "User Not Authorized" | Login first |
| "CORS error" | Check FRONTEND_URL |
| "Invalid UUID" | Use correct ID format |
| "Email already registered" | Use different email |

## 📁 File Structure

```
backend/
├── config/
│   └── config.env              ← Environment variables
├── controllers/
│   ├── userController.js       ← User logic
│   ├── jobController.js        ← Job logic
│   └── applicationController.js ← Application logic
├── database/
│   ├── supabaseClient.js       ← DB connection
│   └── schema.sql              ← DB schema
├── middlewares/
│   ├── auth.js                 ← Authentication
│   ├── error.js                ← Error handling
│   └── catchAsyncError.js      ← Async wrapper
├── routes/
│   ├── userRoutes.js           ← User routes
│   ├── jobRoutes.js            ← Job routes
│   └── applicationRoutes.js    ← Application routes
├── utils/
│   ├── jwtToken.js             ← JWT utilities
│   ├── passwordUtils.js        ← Password hashing
│   └── tokenUtils.js           ← Token generation
├── app.js                      ← Express app
├── server.js                   ← Server startup
└── package.json                ← Dependencies
```

## 🎯 User Roles

### Job Seeker Can:
- ✅ Register and login
- ✅ View all jobs
- ✅ Apply to jobs
- ✅ View their applications
- ✅ Delete pending applications
- ❌ Post jobs
- ❌ View all applications

### Employer Can:
- ✅ Register and login
- ✅ View all jobs
- ✅ Post jobs
- ✅ Update their jobs
- ✅ Delete their jobs
- ✅ View applications for their jobs
- ✅ Accept/reject applications
- ❌ Apply to jobs

## 🔐 Authentication Flow

```
1. User registers → Password hashed → Stored in DB
2. User logs in → Password compared → JWT generated
3. JWT sent in cookie → Stored in browser
4. Protected routes → Check cookie → Verify JWT → Get user
5. User logs out → Cookie cleared
```

## 📦 Dependencies

### Removed
- ❌ mongoose

### Added
- ✅ @supabase/supabase-js

### Kept
- bcrypt (password hashing)
- jsonwebtoken (JWT)
- express (web framework)
- cloudinary (file upload)
- validator (validation)
- cors (CORS)
- cookie-parser (cookies)
- express-fileupload (file upload)

## 🎨 Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error message"
}
```

## 🔗 Useful Links

- Supabase Dashboard: https://app.supabase.com
- Supabase Docs: https://supabase.com/docs
- Cloudinary Dashboard: https://cloudinary.com/console

## 📞 Support Files

| Issue | Check File |
|-------|-----------|
| Setup | SETUP_CHECKLIST.md |
| Errors | TROUBLESHOOTING.md |
| API | backend/README.md |
| Changes | MIGRATION_SUMMARY.md |
| Code | COMPARISON.md |
| Architecture | ARCHITECTURE.md |

## ⚡ Quick Checks

### Is server running?
```bash
curl http://localhost:4000/api/v1/job/getall
```

### Is Supabase connected?
Check server logs for "Supabase Connected Successfully!"

### Are tables created?
Go to Supabase Dashboard → Table Editor

### Is user registered?
Check Supabase → Table Editor → users table

## 🎓 Learning Path

1. Read START_HERE.md
2. Follow SETUP_CHECKLIST.md
3. Test with API client
4. Review COMPARISON.md
5. Understand ARCHITECTURE.md
6. Deploy to production

---

**Need detailed help?** Open START_HERE.md
**Having issues?** Check TROUBLESHOOTING.md
**Want to understand?** Read COMPARISON.md
