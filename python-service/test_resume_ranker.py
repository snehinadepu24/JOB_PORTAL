"""
Test script for EnhancedResumeRanker
"""
from resume_ranker import EnhancedResumeRanker

def test_summary_generation():
    """Test the generate_summary method"""
    print("=" * 60)
    print("Testing Summary Generation")
    print("=" * 60)
    
    ranker = EnhancedResumeRanker()
    
    # Sample resume text
    sample_resume = """
    John Doe
    Senior Software Engineer
    
    Professional Summary:
    Experienced software engineer with 8 years of expertise in full-stack development.
    Specialized in building scalable web applications using modern technologies.
    Strong background in cloud infrastructure and microservices architecture.
    
    Technical Skills:
    - Programming Languages: Python, JavaScript, TypeScript, Java
    - Frameworks: React, Node.js, Express, Django, Flask
    - Cloud: AWS, Docker, Kubernetes
    - Databases: PostgreSQL, MongoDB, Redis
    
    Work Experience:
    Senior Software Engineer at Tech Corp (2020-Present)
    - Led development of microservices platform serving 1M+ users
    - Implemented CI/CD pipelines reducing deployment time by 60%
    - Mentored team of 5 junior developers
    
    Software Engineer at StartupXYZ (2016-2020)
    - Built RESTful APIs handling 10K requests per second
    - Developed React-based dashboard for analytics
    - Optimized database queries improving performance by 40%
    
    Education:
    Master of Science in Computer Science
    University of Technology, 2016
    
    Projects:
    - E-commerce Platform: Built scalable online shopping system
    - Real-time Chat Application: Implemented WebSocket-based messaging
    - Machine Learning Pipeline: Created automated data processing system
    """
    
    # Generate summary
    summary = ranker.generate_summary(sample_resume, max_length=200)
    
    print(f"\nOriginal Resume Length: {len(sample_resume)} characters")
    print(f"Summary Length: {len(summary)} characters")
    print(f"\nGenerated Summary:\n{summary}")
    print("\n" + "=" * 60)
    
    # Test with short text
    short_text = "Software engineer with Python experience."
    short_summary = ranker.generate_summary(short_text, max_length=200)
    print(f"\nShort Text Summary: {short_summary}")
    print("=" * 60)

def test_feature_extraction():
    """Test feature extraction"""
    print("\n" + "=" * 60)
    print("Testing Feature Extraction")
    print("=" * 60)
    
    ranker = EnhancedResumeRanker()
    
    sample_resume = """
    Senior Software Engineer with 8 years of experience in Python, JavaScript, React, 
    Node.js, AWS, Docker, and PostgreSQL. Master's degree in Computer Science.
    
    Developed 15+ projects including:
    - E-commerce platform
    - Real-time analytics dashboard
    - Microservices architecture
    - Machine learning pipeline
    - Mobile application backend
    """
    
    features = ranker._extract_features(sample_resume)
    
    print(f"\nExtracted Features:")
    print(f"  Skills: {features['skills']}")
    print(f"  Years Experience: {features['years_experience']}")
    print(f"  Project Count: {features['project_count']}")
    print(f"  Education Score: {features['education_score']}")
    print("=" * 60)

def test_fit_score():
    """Test fit score calculation"""
    print("\n" + "=" * 60)
    print("Testing Fit Score Calculation")
    print("=" * 60)
    
    ranker = EnhancedResumeRanker()
    
    resume_text = """
    Senior Software Engineer with 8 years of experience in Python, JavaScript, React, 
    Node.js, AWS, Docker, and PostgreSQL. Master's degree in Computer Science.
    Built 15+ projects including microservices, APIs, and cloud infrastructure.
    """
    
    job_description = """
    We are looking for a Senior Software Engineer with strong experience in Python,
    React, and AWS. The ideal candidate should have 5+ years of experience building
    scalable web applications and microservices. Master's degree preferred.
    """
    
    features = ranker._extract_features(resume_text)
    fit_score = ranker._compute_fit_score(resume_text, job_description, features)
    
    print(f"\nJob Description: {job_description[:100]}...")
    print(f"\nResume Summary: {resume_text[:100]}...")
    print(f"\nComputed Fit Score: {fit_score:.2f}/100")
    print("=" * 60)

def test_error_handling():
    """Test error handling"""
    print("\n" + "=" * 60)
    print("Testing Error Handling")
    print("=" * 60)
    
    ranker = EnhancedResumeRanker()
    
    # Test with empty text
    empty_summary = ranker.generate_summary("", max_length=200)
    print(f"\nEmpty Text Summary: {empty_summary}")
    
    # Test with very short text
    short_summary = ranker.generate_summary("Hi", max_length=200)
    print(f"Very Short Text Summary: {short_summary}")
    
    print("=" * 60)

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("ENHANCED RESUME RANKER TEST SUITE")
    print("=" * 60)
    
    test_summary_generation()
    test_feature_extraction()
    test_fit_score()
    test_error_handling()
    
    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETED")
    print("=" * 60)
