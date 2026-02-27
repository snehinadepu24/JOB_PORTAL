"""
Flask API for AI Hiring Orchestrator - Resume Intelligence Engine
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging

from resume_ranker import EnhancedResumeRanker

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize resume ranker
ranker = EnhancedResumeRanker()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'resume-intelligence-engine'}), 200

@app.route('/api/python/process-resume', methods=['POST'])
def process_resume():
    """
    Process resume: parse, extract features, generate summary, compute fit score
    
    Request body:
    {
        "application_id": "uuid",
        "resume_url": "cloudinary_url",
        "job_description": "string"
    }
    
    Response:
    {
        "success": true,
        "fit_score": 85.5,
        "summary": "Senior software engineer with 8 years experience...",
        "extracted_features": {
            "skills": ["Python", "React", "AWS"],
            "years_experience": 8,
            "project_count": 12,
            "education_score": 4
        }
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data or 'application_id' not in data or 'resume_url' not in data or 'job_description' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: application_id, resume_url, job_description'
            }), 400
        
        application_id = data['application_id']
        resume_url = data['resume_url']
        job_description = data['job_description']
        
        logger.info(f"Processing resume for application {application_id}")
        
        # Process the application
        result = ranker.process_application(application_id, resume_url, job_description)
        
        logger.info(f"Successfully processed application {application_id} with fit_score: {result['fit_score']}")
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error processing resume: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
