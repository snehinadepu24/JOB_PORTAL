# Deployment Guide - Supabase Edition

Complete guide for deploying your Job Portal to production.

## 🎯 Deployment Overview

```
Frontend (Vercel/Netlify)
    ↓
Backend (Vercel/Railway/Render)
    ↓
Supabase (Database - Already Hosted)
    ↓
Cloudinary (File Storage - Already Hosted)
```

## 📋 Pre-Deployment Checklist

- [ ] Backend runs successfully locally
- [ ] Frontend runs successfully locally
- [ ] All tests pass
- [ ] Environment variables documented
- [ ] Database schema deployed to Supabase
- [ ] Cloudinary account configured
- [ ] Domain name ready (optional)

## 🗄️ Database Deployment (Supabase)

### Already Done!
Your Supabase database is already hosted and production-ready. No additional deployment needed.

### Production Checklist
- [ ] Database tables created (schema.sql executed)
- [ ] Indexes created
- [ ] Row Level Security policies configured (optional)
- [ ] Backup policy configured
- [ ] Connection limits reviewed

### Supabase Production Settings

1. **Go to Settings > Database**
   - Review connection pooling settings
   - Note connection string for backend

2. **Go to Settings > API**
   - Copy production API keys
   - Never commit these to git!

3. **Go to Database > Backups** (Paid plans)
   - Enable automatic backups
   - Set backup schedule

## 🚀 Backend Deployment

### Option 1: Vercel (Recommended)

#### Step 1: Prepare for Vercel
Create `vercel.json` in backend folder:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

#### Step 2: Deploy
```bash
cd backend
npm install -g vercel
vercel login
vercel
```

#### Step 3: Set Environment Variables
In Vercel Dashboard:
1. Go to your project
2. Settings > Environment Variables
3. Add all variables from config.env:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - CLOUDINARY_CLOUD_NAME
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET
   - JWT_SECRET_KEY
   - JWT_EXPIRE
   - COOKIE_EXPIRE
   - FRONTEND_URL (update to production URL)

#### Step 4: Redeploy
```bash
vercel --prod
```

---

### Option 2: Railway

#### Step 1: Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

#### Step 2: Initialize Project
```bash
cd backend
railway init
```

#### Step 3: Add Environment Variables
```bash
railway variables set SUPABASE_URL=your_url
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_key
# ... add all other variables
```

#### Step 4: Deploy
```bash
railway up
```

---

### Option 3: Render

#### Step 1: Create render.yaml
Create `render.yaml` in backend folder:
```yaml
services:
  - type: web
    name: job-portal-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: CLOUDINARY_CLOUD_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
      - key: JWT_SECRET_KEY
        sync: false
      - key: JWT_EXPIRE
        value: 7d
      - key: COOKIE_EXPIRE
        value: 3
```

#### Step 2: Deploy
1. Go to https://render.com
2. Connect your GitHub repository
3. Select backend folder
4. Add environment variables
5. Deploy

---

## 🎨 Frontend Deployment

### Option 1: Vercel (Recommended)

#### Step 1: Update API URL
In your frontend code, update the API base URL:
```javascript
// src/config.js or similar
const API_URL = process.env.VITE_API_URL || 'https://your-backend.vercel.app';
```

#### Step 2: Create .env.production
```env
VITE_API_URL=https://your-backend.vercel.app
```

#### Step 3: Deploy
```bash
cd frontend
vercel
```

#### Step 4: Set Environment Variables
In Vercel Dashboard, add:
- VITE_API_URL

---

### Option 2: Netlify

#### Step 1: Create netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Step 2: Deploy
```bash
cd frontend
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

---

## 🔐 Environment Variables Management

### Backend Production Variables
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# JWT
JWT_SECRET_KEY=generate-strong-random-key-here
JWT_EXPIRE=7d
COOKIE_EXPIRE=3

# URLs
FRONTEND_URL=https://your-frontend.vercel.app
PORT=4000
```

### Frontend Production Variables
```env
VITE_API_URL=https://your-backend.vercel.app
```

### Security Notes
- ⚠️ Never commit .env files to git
- ⚠️ Use different keys for production
- ⚠️ Generate strong JWT_SECRET_KEY
- ⚠️ Use HTTPS in production
- ⚠️ Keep SUPABASE_SERVICE_ROLE_KEY secret

## 🔒 Security Hardening

### 1. Update CORS Settings
In `backend/app.js`:
```javascript
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Only your frontend
    methods: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);
```

### 2. Enable HTTPS Only Cookies
In `backend/utils/jwtToken.js`:
```javascript
const options = {
  expires: new Date(
    Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
  ),
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict',
};
```

### 3. Add Rate Limiting
```bash
npm install express-rate-limit
```

```javascript
// backend/app.js
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. Add Helmet for Security Headers
```bash
npm install helmet
```

```javascript
// backend/app.js
import helmet from 'helmet';
app.use(helmet());
```

### 5. Configure Supabase RLS
In Supabase SQL Editor:
```sql
-- Example: Users can only read their own data
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Example: Only employers can create jobs
CREATE POLICY "Employers can create jobs"
  ON jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'Employer'
    )
  );
```

## 📊 Monitoring & Logging

### Supabase Monitoring
1. Go to Supabase Dashboard
2. Check Database > Logs
3. Monitor API usage
4. Set up alerts for errors

### Backend Monitoring

#### Option 1: Vercel Analytics
- Automatically enabled on Vercel
- View in Vercel Dashboard

#### Option 2: Custom Logging
```bash
npm install winston
```

```javascript
// backend/utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

export default logger;
```

### Frontend Monitoring

#### Vercel Analytics
```bash
npm install @vercel/analytics
```

```javascript
// src/main.jsx
import { Analytics } from '@vercel/analytics/react';

<App />
<Analytics />
```

## 🧪 Testing Production

### Backend Health Check
```bash
curl https://your-backend.vercel.app/api/v1/job/getall
```

### Frontend Check
1. Open https://your-frontend.vercel.app
2. Try registering a user
3. Try logging in
4. Try posting a job
5. Try applying to a job

### Database Check
1. Go to Supabase Dashboard
2. Check Table Editor
3. Verify data is being created

## 🔄 CI/CD Setup

### GitHub Actions for Backend
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm install
      - name: Deploy to Vercel
        run: cd backend && vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Automatic Deployments
- Vercel: Automatically deploys on git push
- Netlify: Automatically deploys on git push
- Railway: Automatically deploys on git push
- Render: Automatically deploys on git push

## 📈 Performance Optimization

### Backend
1. Enable compression:
```bash
npm install compression
```

```javascript
import compression from 'compression';
app.use(compression());
```

2. Add caching headers:
```javascript
app.use((req, res, next) => {
  if (req.url.startsWith('/api/v1/job/getall')) {
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  }
  next();
});
```

### Frontend
1. Build optimization:
```bash
npm run build
```

2. Enable code splitting (Vite does this automatically)

3. Optimize images in public folder

### Database
1. Ensure indexes are created (already in schema.sql)
2. Monitor slow queries in Supabase Dashboard
3. Use connection pooling (automatic with Supabase)

## 🌐 Custom Domain Setup

### Backend Domain
1. In Vercel/Railway/Render dashboard
2. Go to Settings > Domains
3. Add your custom domain
4. Update DNS records as instructed
5. Wait for SSL certificate

### Frontend Domain
1. In Vercel/Netlify dashboard
2. Go to Settings > Domains
3. Add your custom domain
4. Update DNS records
5. Wait for SSL certificate

### Update Environment Variables
After setting up domains:
1. Update FRONTEND_URL in backend
2. Update VITE_API_URL in frontend
3. Redeploy both

## 🔧 Troubleshooting Production

### Backend Issues

**"Cannot connect to database"**
- Check SUPABASE_URL and keys
- Verify Supabase project is active
- Check network/firewall settings

**"CORS error"**
- Verify FRONTEND_URL matches exactly
- Check CORS configuration
- Ensure credentials: true

**"Environment variables not found"**
- Verify all variables are set in platform
- Redeploy after adding variables
- Check variable names match exactly

### Frontend Issues

**"API calls failing"**
- Check VITE_API_URL is correct
- Verify backend is deployed and running
- Check browser console for errors

**"404 on refresh"**
- Add redirect rules (see Netlify/Vercel config above)
- Ensure SPA routing is configured

## 📝 Post-Deployment Checklist

- [ ] Backend is accessible
- [ ] Frontend is accessible
- [ ] User registration works
- [ ] User login works
- [ ] Job posting works
- [ ] Job application works
- [ ] File upload works
- [ ] All API endpoints respond
- [ ] HTTPS is enabled
- [ ] Custom domains configured (if applicable)
- [ ] Monitoring is set up
- [ ] Backups are configured
- [ ] Error logging is working
- [ ] Performance is acceptable

## 🎉 You're Live!

Your Job Portal is now deployed and ready for users!

### Next Steps
1. Share the URL with users
2. Monitor for errors
3. Collect user feedback
4. Plan future enhancements

### Maintenance
- Monitor Supabase usage
- Check error logs regularly
- Update dependencies monthly
- Review security settings quarterly
- Backup database regularly (automatic with Supabase)

---

**Need help?** Check TROUBLESHOOTING.md
**Want to optimize?** See ARCHITECTURE.md
