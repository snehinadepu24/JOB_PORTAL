# MongoDB vs Supabase - Code Comparison

This document shows side-by-side comparisons of how the code changed from MongoDB to Supabase.

## 1. Database Connection

### MongoDB (Before)
```javascript
// database/dbConnection.js
import mongoose from "mongoose";

const dbConnection = () => {
  mongoose
    .connect(process.env.DB_URL, {
      dbName: "Job_Portal",
    })
    .then(() => {
      console.log("MongoDB Connected Successfully!");
    })
    .catch((error) => {
      console.log(`Failed to connect: ${error}`);
    });
};

export default dbConnection;
```

### Supabase (After)
```javascript
// database/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Supabase Connected Successfully!');
```

---

## 2. User Registration

### MongoDB (Before)
```javascript
// Check if email exists
const isEmail = await User.findOne({ email });
if (isEmail) {
  return next(new ErrorHandler("Email already registered !"));
}

// Create user
const user = await User.create({
  name,
  email,
  phone,
  password, // Auto-hashed by Mongoose pre-save hook
  role,
  favouriteSport,
});
```

### Supabase (After)
```javascript
// Check if email exists
const { data: existingUser } = await supabase
  .from('users')
  .select('id')
  .eq('email', email)
  .single();

if (existingUser) {
  return next(new ErrorHandler("Email already registered !"));
}

// Hash password manually
const hashedPassword = await hashPassword(password);

// Create user
const { data: user, error } = await supabase
  .from('users')
  .insert([{
    name,
    email,
    phone: parseInt(phone),
    password: hashedPassword,
    role,
    favourite_sport: favouriteSport,
  }])
  .select()
  .single();
```

---

## 3. User Login

### MongoDB (Before)
```javascript
// Find user with password
const user = await User.findOne({ email }).select("+password");

if (!user) {
  return next(new ErrorHandler("Invalid Email Or Password.", 400));
}

// Compare password using Mongoose method
const isPasswordMatched = await user.comparePassword(password);
```

### Supabase (After)
```javascript
// Get user with password
const { data: user, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', email)
  .single();

if (error || !user) {
  return next(new ErrorHandler("Invalid Email Or Password.", 400));
}

// Compare password using utility function
const isPasswordMatched = await comparePassword(password, user.password);
```

---

## 4. Get All Jobs

### MongoDB (Before)
```javascript
const jobs = await Job.find({ expired: false });

res.status(200).json({
  success: true,
  jobs,
});
```

### Supabase (After)
```javascript
const { data: jobs, error } = await supabase
  .from('jobs')
  .select('*')
  .eq('expired', false)
  .order('job_posted_on', { ascending: false });

if (error) {
  return next(new ErrorHandler(error.message, 500));
}

res.status(200).json({
  success: true,
  jobs,
});
```

---

## 5. Create Job

### MongoDB (Before)
```javascript
const postedBy = req.user._id;

const job = await Job.create({
  title,
  description,
  category,
  country,
  city,
  location,
  fixedSalary,
  salaryFrom,
  salaryTo,
  postedBy,
});
```

### Supabase (After)
```javascript
const postedBy = req.user.id;

const { data: job, error } = await supabase
  .from('jobs')
  .insert([{
    title,
    description,
    category,
    country,
    city,
    location,
    fixed_salary: fixedSalary ? parseInt(fixedSalary) : null,
    salary_from: salaryFrom ? parseInt(salaryFrom) : null,
    salary_to: salaryTo ? parseInt(salaryTo) : null,
    posted_by: postedBy,
  }])
  .select()
  .single();
```

---

## 6. Update Job

### MongoDB (Before)
```javascript
let job = await Job.findById(id);

if (!job) {
  return next(new ErrorHandler("OOPS! Job not found.", 404));
}

job = await Job.findByIdAndUpdate(id, req.body, {
  new: true,
  runValidators: true,
  useFindAndModify: false,
});
```

### Supabase (After)
```javascript
// Check if job exists
const { data: job, error: fetchError } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', id)
  .single();

if (fetchError || !job) {
  return next(new ErrorHandler("OOPS! Job not found.", 404));
}

// Update job
const { error: updateError } = await supabase
  .from('jobs')
  .update(updateData)
  .eq('id', id);
```

---

## 7. Delete Job

### MongoDB (Before)
```javascript
const job = await Job.findById(id);

if (!job) {
  return next(new ErrorHandler("OOPS! Job not found.", 404));
}

await job.deleteOne();
```

### Supabase (After)
```javascript
const { data: job, error: fetchError } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', id)
  .single();

if (fetchError || !job) {
  return next(new ErrorHandler("OOPS! Job not found.", 404));
}

const { error: deleteError } = await supabase
  .from('jobs')
  .delete()
  .eq('id', id);
```

---

## 8. Get Applications by User

### MongoDB (Before)
```javascript
// For employer
const applications = await Application.find({ 
  "employerID.user": req.user._id 
});

// For job seeker
const applications = await Application.find({ 
  "applicantID.user": req.user._id 
});
```

### Supabase (After)
```javascript
// For employer
const { data: applications, error } = await supabase
  .from('applications')
  .select('*')
  .eq('employer_id', req.user.id)
  .order('created_at', { ascending: false });

// For job seeker
const { data: applications, error } = await supabase
  .from('applications')
  .select('*')
  .eq('applicant_id', req.user.id)
  .order('created_at', { ascending: false });
```

---

## 9. Authentication Middleware

### MongoDB (Before)
```javascript
const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

// Get user from MongoDB
req.user = await User.findById(decoded.id);

next();
```

### Supabase (After)
```javascript
const decoded = verifyJWTToken(token);

// Get user from Supabase
const { data: user, error } = await supabase
  .from('users')
  .select('id, name, email, phone, role, favourite_sport, created_at')
  .eq('id', decoded.id)
  .single();

if (error || !user) {
  return next(new ErrorHandler("User Not Found", 404));
}

req.user = user;
next();
```

---

## 10. Schema Definition

### MongoDB (Before)
```javascript
// models/userSchema.js
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter your Name!"],
    minLength: [3, "Name must contain at least 3 Characters!"],
    maxLength: [30, "Name cannot exceed 30 Characters!"],
  },
  email: {
    type: String,
    required: [true, "Please enter your Email!"],
    validate: [validator.isEmail, "Please provide a valid Email!"],
  },
  // ... more fields
});

export const User = mongoose.model("User", userSchema);
```

### Supabase (After)
```sql
-- database/schema.sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL CHECK (char_length(name) >= 3),
  email VARCHAR(255) NOT NULL UNIQUE,
  phone BIGINT NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('Job Seeker', 'Employer')),
  favourite_sport VARCHAR(30) NOT NULL CHECK (char_length(favourite_sport) >= 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Key Differences Summary

| Aspect | MongoDB | Supabase |
|--------|---------|----------|
| **Query Style** | Method chaining | SQL-like with JS |
| **ID Type** | ObjectId | UUID |
| **Field Names** | camelCase | snake_case |
| **Schema** | JavaScript models | SQL DDL |
| **Validation** | Mongoose validators | SQL constraints |
| **Relationships** | Refs & populate | Foreign keys |
| **Error Handling** | Try-catch | Check error object |
| **Password Hashing** | Pre-save hooks | Manual utils |
| **Transactions** | Sessions | Built-in |
| **Real-time** | Change streams | Built-in subscriptions |

---

## Query Pattern Comparison

| Operation | MongoDB | Supabase |
|-----------|---------|----------|
| **Find One** | `Model.findOne({ field })` | `supabase.from('table').select().eq('field', value).single()` |
| **Find Many** | `Model.find({ field })` | `supabase.from('table').select().eq('field', value)` |
| **Create** | `Model.create(data)` | `supabase.from('table').insert([data]).select()` |
| **Update** | `Model.findByIdAndUpdate(id, data)` | `supabase.from('table').update(data).eq('id', id)` |
| **Delete** | `Model.findByIdAndDelete(id)` | `supabase.from('table').delete().eq('id', id)` |
| **Count** | `Model.countDocuments()` | `supabase.from('table').select('count')` |
| **Sort** | `.sort({ field: -1 })` | `.order('field', { ascending: false })` |
| **Limit** | `.limit(10)` | `.limit(10)` |

---

## Benefits of Supabase Approach

1. ✅ **Type Safety** - SQL schema provides strong typing
2. ✅ **Performance** - PostgreSQL is highly optimized
3. ✅ **Relationships** - Foreign keys enforced at DB level
4. ✅ **Transactions** - ACID compliance built-in
5. ✅ **Tooling** - Excellent dashboard and monitoring
6. ✅ **Real-time** - Built-in subscriptions
7. ✅ **Scalability** - Better horizontal scaling
8. ✅ **Standards** - SQL is universal

---

## Migration Effort

- **Time**: ~2-3 hours for this project
- **Complexity**: Medium (straightforward mapping)
- **Breaking Changes**: None (API remains the same)
- **Testing Required**: Full regression testing
- **Frontend Impact**: Zero (no changes needed)
