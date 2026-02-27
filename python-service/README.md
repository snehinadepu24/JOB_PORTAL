# Resume Intelligence Engine - Python Service

AI-powered resume processing service for the AI Hiring Orchestrator.

## Features

- **Resume Parsing**: Extract text from PDF resumes
- **Feature Extraction**: Identify skills, experience, projects, and education
- **AI Summary Generation**: Create concise candidate profile summaries using extractive summarization
- **Fit Score Calculation**: Compute weighted match score between resume and job description

## Setup

### Prerequisites

- Python 3.8+
- pip

### Installation

1. Navigate to the python-service directory:
```bash
cd python-service
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
```bash
# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create `.env` file:
```bash
cp .env.example .env
```

6. Edit `.env` with your configuration:
```
FLASK_PORT=5001
FLASK_ENV=development
NODE_API_URL=http://localhost:4000
```

## Running the Service

```bash
python app.py
```

The service will start on `http://localhost:5001`

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "resume-intelligence-engine"
}
```

### Process Resume
```
POST /api/python/process-resume
```

Request body:
```json
{
  "application_id": "uuid",
  "resume_url": "https://cloudinary.com/...",
  "job_description": "We are looking for a senior software engineer..."
}
```

Response:
```json
{
  "success": true,
  "fit_score": 85.5,
  "summary": "Senior software engineer with 8 years experience in Python, React, and AWS. Built 12+ projects including microservices and cloud infrastructure.",
  "extracted_features": {
    "skills": ["Python", "React", "AWS", "Docker"],
    "years_experience": 8,
    "project_count": 12,
    "education_score": 4
  }
}
```

## Algorithm Details

### Summary Generation

The `generate_summary()` method uses **extractive summarization**:

1. **Sentence Tokenization**: Split resume into sentences using NLTK
2. **TF-IDF Scoring**: Score each sentence based on term importance
3. **Sentence Selection**: Select top-scoring sentences that fit within max_length
4. **Order Preservation**: Return sentences in original order for coherence

### Fit Score Calculation

Weighted scoring algorithm (as per requirements):

- **TF-IDF Similarity** (40%): Cosine similarity between resume and job description
- **Experience** (25%): Years of experience (normalized to 10+ years max)
- **Projects** (20%): Number of projects (normalized to 15+ max)
- **Skills** (10%): Number of technical skills (normalized to 10+ max)
- **Education** (5%): Education level (1-5 scale)

Final score is scaled to 0-100 range.

## Error Handling

- If resume parsing fails, returns `fit_score: 0` and logs error
- If summary generation fails, returns generic error message
- All errors are logged for debugging

## Testing

Run the test script:
```bash
python test_resume_ranker.py
```

## Integration with Node.js Backend

The Node.js backend calls this service when processing applications:

```javascript
const response = await axios.post('http://localhost:5001/api/python/process-resume', {
  application_id: applicationId,
  resume_url: resumeUrl,
  job_description: jobDescription
});

// Store results in database
await supabase
  .from('applications')
  .update({
    fit_score: response.data.fit_score,
    summary: response.data.summary,
    ai_processed: true
  })
  .eq('id', applicationId);
```

## Dependencies

- **Flask**: Web framework
- **PyPDF2**: PDF parsing
- **scikit-learn**: TF-IDF vectorization and similarity
- **NLTK**: Natural language processing (sentence tokenization, stopwords)
- **NumPy**: Numerical operations

## Performance

- Resume processing: ~2-5 seconds per resume
- Timeout: 30 seconds for PDF download
- Concurrent requests: Handled by Flask (can be scaled with Gunicorn)

## Future Enhancements

- Named Entity Recognition (NER) for better feature extraction
- Deep learning models for semantic similarity
- Multi-language support
- Resume format validation
- Caching for repeated job descriptions
