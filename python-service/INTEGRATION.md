# Integration Guide: Python Service with Node.js Backend

This document explains how the Python Resume Intelligence Engine integrates with the Node.js backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Flow                          │
└─────────────────────────────────────────────────────────────┘

1. Candidate submits application with resume PDF
   │
   ▼
2. Node.js Backend (Application Controller)
   - Uploads resume to Cloudinary
   - Creates application record in database
   - Triggers async processing
   │
   ▼
3. Python Service (Resume Intelligence Engine)
   - Downloads resume from Cloudinary
   - Parses PDF and extracts text
   - Extracts features (skills, experience, projects, education)
   - Generates AI summary using extractive summarization
   - Computes fit score using weighted algorithm
   │
   ▼
4. Node.js Backend (Callback)
   - Receives processing results
   - Updates application record:
     * fit_score
     * summary
     * ai_processed = true
   │
   ▼
5. Shortlisting Manager (if conditions met)
   - Auto-shortlist top N candidates
   - Place next N in buffer pool
```

## Node.js Backend Integration

### Step 1: Add Python Service Configuration

Add to `backend/config/config.js`:

```javascript
module.exports = {
  // ... existing config
  
  pythonService: {
    url: process.env.PYTHON_SERVICE_URL || 'http://localhost:5001',
    timeout: 30000 // 30 seconds
  }
};
```

Add to `backend/.env`:

```
PYTHON_SERVICE_URL=http://localhost:5001
```

### Step 2: Create Python Service Client

Create `backend/utils/pythonServiceClient.js`:

```javascript
const axios = require('axios');
const config = require('../config/config');

class PythonServiceClient {
  constructor() {
    this.baseURL = config.pythonService.url;
    this.timeout = config.pythonService.timeout;
  }

  async processResume(applicationId, resumeUrl, jobDescription) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/python/process-resume`,
        {
          application_id: applicationId,
          resume_url: resumeUrl,
          job_description: jobDescription
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error calling Python service:', error.message);
      
      // Return error state (fit_score = 0)
      return {
        success: false,
        fit_score: 0,
        summary: '',
        extracted_features: {
          skills: [],
          years_experience: 0,
          project_count: 0,
          education_score: 0
        },
        error: error.message
      };
    }
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new PythonServiceClient();
```

### Step 3: Update Application Controller

Modify `backend/controllers/applicationController.js`:

```javascript
const pythonServiceClient = require('../utils/pythonServiceClient');
const supabase = require('../config/supabaseClient');

// Existing postApplication function - add async processing
exports.postApplication = async (req, res) => {
  try {
    // ... existing code to upload resume and create application ...
    
    // After application is created:
    const applicationId = newApplication.id;
    const resumeUrl = cloudinaryResult.secure_url;
    
    // Get job description
    const { data: job } = await supabase
      .from('jobs')
      .select('description')
      .eq('id', jobId)
      .single();
    
    // Trigger async resume processing (don't wait for completion)
    processResumeAsync(applicationId, resumeUrl, job.description);
    
    // Return success immediately
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application: newApplication
    });
    
  } catch (error) {
    console.error('Error posting application:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting application'
    });
  }
};

// Async function to process resume (runs in background)
async function processResumeAsync(applicationId, resumeUrl, jobDescription) {
  try {
    console.log(`Starting resume processing for application ${applicationId}`);
    
    // Call Python service
    const result = await pythonServiceClient.processResume(
      applicationId,
      resumeUrl,
      jobDescription
    );
    
    // Update application with results
    const { error } = await supabase
      .from('applications')
      .update({
        fit_score: result.fit_score,
        summary: result.summary,
        ai_processed: true
      })
      .eq('id', applicationId);
    
    if (error) {
      console.error(`Error updating application ${applicationId}:`, error);
    } else {
      console.log(`Successfully processed application ${applicationId} with fit_score: ${result.fit_score}`);
    }
    
  } catch (error) {
    console.error(`Error in async resume processing for ${applicationId}:`, error);
    
    // Set ai_processed to true even on error (with fit_score = 0)
    await supabase
      .from('applications')
      .update({
        fit_score: 0,
        summary: '',
        ai_processed: true
      })
      .eq('id', applicationId);
  }
}
```

### Step 4: Add Health Check Endpoint

Add to `backend/routes/healthRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const pythonServiceClient = require('../utils/pythonServiceClient');

router.get('/health', async (req, res) => {
  try {
    // Check Python service health
    const pythonHealth = await pythonServiceClient.healthCheck();
    
    res.json({
      status: 'healthy',
      services: {
        nodejs: 'healthy',
        python: pythonHealth.status
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
```

## Running Both Services

### Development Mode

**Terminal 1 - Python Service:**
```bash
cd python-service
python app.py
```

**Terminal 2 - Node.js Backend:**
```bash
cd backend
npm run dev
```

### Production Mode

Use a process manager like PM2:

```bash
# Start Python service
pm2 start python-service/app.py --name resume-engine --interpreter python3

# Start Node.js backend
pm2 start backend/server.js --name api-server

# View logs
pm2 logs
```

## Testing the Integration

### 1. Test Python Service Directly

```bash
curl -X POST http://localhost:5001/api/python/process-resume \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "test-123",
    "resume_url": "https://example.com/resume.pdf",
    "job_description": "We are looking for a senior software engineer..."
  }'
```

### 2. Test Through Node.js Backend

Submit an application through the frontend or API:

```bash
curl -X POST http://localhost:4000/api/v1/application/post \
  -H "Content-Type: multipart/form-data" \
  -F "resume=@/path/to/resume.pdf" \
  -F "jobId=job-uuid" \
  -F "name=John Doe" \
  -F "email=john@example.com"
```

### 3. Verify Results

Check the database:

```sql
SELECT id, name, fit_score, summary, ai_processed 
FROM applications 
WHERE id = 'application-uuid';
```

## Error Handling

The integration includes multiple layers of error handling:

1. **Python Service Errors**: Returns `fit_score: 0` and logs error
2. **Network Errors**: Node.js catches timeout/connection errors
3. **Database Errors**: Logged and application marked as processed
4. **Resume Parsing Errors**: Handled gracefully, returns error state

## Performance Considerations

- **Async Processing**: Resume processing doesn't block application submission
- **Timeout**: 30-second timeout for Python service calls
- **Retry Logic**: Can be added for transient failures
- **Queue System**: For high volume, consider adding a job queue (Bull, BullMQ)

## Monitoring

Monitor these metrics:

- Python service response time
- Resume processing success rate
- Average fit scores
- Error rates
- Queue backlog (if using queue system)

## Troubleshooting

### Python Service Not Responding

```bash
# Check if service is running
curl http://localhost:5001/health

# Check logs
tail -f python-service/logs/app.log
```

### Resume Processing Failures

Check application records with `ai_processed = false`:

```sql
SELECT id, name, created_at 
FROM applications 
WHERE ai_processed = false 
AND created_at < NOW() - INTERVAL '5 minutes';
```

### High Processing Times

- Check PDF size (large PDFs take longer)
- Monitor Python service CPU/memory usage
- Consider adding caching for job descriptions
- Scale Python service horizontally if needed

## Next Steps

After implementing this integration:

1. Test with various resume formats (PDF, different layouts)
2. Monitor processing times and success rates
3. Implement Task 2.2: Property tests for resume processing
4. Implement Task 2.3: Automatic shortlisting trigger
5. Add queue system for high-volume scenarios
