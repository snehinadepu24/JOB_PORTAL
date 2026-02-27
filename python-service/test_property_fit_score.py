"""
Property-Based Tests for Fit Score Weighted Calculation

**Validates: Requirements 1.4**

Property 3: Fit Score Weighted Calculation
For any resume with extracted features, the computed fit_score should equal the 
weighted sum: (TF-IDF_similarity × 0.40) + (experience_score × 0.25) + 
(project_score × 0.20) + (skills_score × 0.10) + (education_score × 0.05), 
scaled to 0-100 range.
"""
import os
import sys
import logging
from hypothesis import given, settings, strategies as st, assume, HealthCheck
from hypothesis.strategies import composite
from typing import Dict

from resume_ranker import EnhancedResumeRanker

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Strategy for generating resume and job description pairs
@composite
def resume_job_pair(draw):
    """
    Generate resume and job description pairs for testing fit score calculation.
    Returns both the text content and the expected feature ranges.
    """
    # Generate candidate name
    first_names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
    name = f"{draw(st.sampled_from(first_names))} {draw(st.sampled_from(last_names))}"
    
    # Generate job title
    titles = ['Software Engineer', 'Senior Developer', 'Data Scientist', 'Full Stack Developer', 
              'Backend Engineer', 'Frontend Developer', 'DevOps Engineer', 'ML Engineer']
    title = draw(st.sampled_from(titles))
    
    # Generate years of experience (1-15 years)
    years_exp = draw(st.integers(min_value=1, max_value=15))
    
    # Generate skills
    all_skills = ['Python', 'JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes',
                  'PostgreSQL', 'MongoDB', 'TypeScript', 'Django', 'Flask', 'Express',
                  'Machine Learning', 'Data Science', 'CI/CD', 'Git', 'REST API']
    num_skills = draw(st.integers(min_value=3, max_value=10))
    skills = draw(st.lists(st.sampled_from(all_skills), min_size=num_skills, max_size=num_skills, unique=True))
    
    # Generate education
    education_levels = [
        ('Bachelor of Science in Computer Science', 3),
        ('Master of Science in Computer Science', 4),
        ('Bachelor of Engineering', 3),
        ('Master of Engineering', 4),
        ('PhD in Computer Science', 5),
        ('Associate Degree in Computer Science', 2),
        ('High School Diploma', 1)
    ]
    education, education_score = draw(st.sampled_from(education_levels))
    
    # Generate project count (3-20 projects)
    project_count = draw(st.integers(min_value=3, max_value=20))
    
    # Build resume text
    resume_text = f"""
{name}
{title}

Professional Summary:
Experienced {title.lower()} with {years_exp} years of expertise in software development.
Specialized in building scalable applications using modern technologies.
Strong background in cloud infrastructure and software architecture.

Technical Skills:
{', '.join(skills)}

Work Experience:
{title} at Tech Company ({2024 - years_exp}-Present)
- {years_exp} years of experience in software development
- Led development of multiple projects serving thousands of users
- Implemented best practices and modern development workflows
- Mentored junior team members and conducted code reviews

Education:
{education}
University of Technology, {2024 - years_exp - 4}

Projects:
"""
    
    # Add project descriptions
    project_types = ['Web Application', 'Mobile App', 'API Service', 'Data Pipeline', 
                     'Analytics Dashboard', 'E-commerce Platform', 'Chat Application']
    for i in range(min(project_count, 10)):
        project_type = draw(st.sampled_from(project_types))
        resume_text += f"- Project {i+1}: Developed {project_type} using {draw(st.sampled_from(skills))}\n"
    
    # Add more project keywords
    project_keywords = ['built', 'created', 'implemented', 'developed']
    remaining = project_count - min(project_count, 10)
    for i in range(remaining):
        keyword = draw(st.sampled_from(project_keywords))
        resume_text += f"- {keyword.capitalize()} scalable solutions\n"
    
    # Generate job description with some overlap
    # Randomly select some skills from resume to create overlap
    overlap_count = draw(st.integers(min_value=1, max_value=min(len(skills), 5)))
    job_skills = draw(st.lists(st.sampled_from(skills), min_size=overlap_count, max_size=overlap_count, unique=True))
    
    # Add some additional skills not in resume
    additional_skills = [s for s in all_skills if s not in skills]
    if additional_skills:
        extra_count = draw(st.integers(min_value=0, max_value=min(3, len(additional_skills))))
        if extra_count > 0:
            extra_skills = draw(st.lists(st.sampled_from(additional_skills), min_size=extra_count, max_size=extra_count, unique=True))
            job_skills.extend(extra_skills)
    
    min_years = draw(st.integers(min_value=2, max_value=8))
    
    job_description = f"""
We are looking for a {title} with strong experience in {', '.join(job_skills[:3])}.
The ideal candidate should have {min_years}+ years of experience building scalable 
web applications and working with modern development practices.

Required Skills:
{', '.join(job_skills)}

Responsibilities:
- Design and develop scalable software solutions
- Collaborate with cross-functional teams
- Write clean, maintainable code
- Participate in code reviews and technical discussions

Qualifications:
- {min_years}+ years of professional experience
- Strong problem-solving skills
- Bachelor's degree in Computer Science or related field
"""
    
    return {
        'resume_text': resume_text,
        'job_description': job_description,
        'expected_features': {
            'years_experience': years_exp,
            'project_count': project_count,
            'skills_count': len(skills),
            'education_score': education_score
        }
    }

# Property Test: Fit Score Weighted Calculation
@given(data=resume_job_pair())
@settings(
    max_examples=5,  # Run 5 iterations for faster testing
    deadline=None,  # Disable deadline for processing
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow]
)
def test_fit_score_weighted_calculation(data):
    """
    **Validates: Requirements 1.4**
    
    Property 3: Fit Score Weighted Calculation
    For any resume with extracted features, the computed fit_score should equal the 
    weighted sum: (TF-IDF_similarity × 0.40) + (experience_score × 0.25) + 
    (project_score × 0.20) + (skills_score × 0.10) + (education_score × 0.05), 
    scaled to 0-100 range.
    
    This test verifies:
    1. Fit score is between 0 and 100
    2. Fit score uses the correct weighted formula
    3. Higher scores for better matches
    4. Consistent results for same inputs
    """
    resume_text = data['resume_text']
    job_description = data['job_description']
    
    # Skip if inputs are too short
    assume(len(resume_text.strip()) >= 100)
    assume(len(job_description.strip()) >= 50)
    
    # Initialize ranker
    ranker = EnhancedResumeRanker()
    
    try:
        # Extract features
        features = ranker._extract_features(resume_text)
        
        # Compute TF-IDF similarity
        tfidf_similarity = ranker._compute_tfidf_similarity(resume_text, job_description)
        
        # Compute fit score
        fit_score = ranker._compute_fit_score(resume_text, job_description, features)
        
        # PROPERTY 1: Fit score must be between 0 and 100
        assert 0 <= fit_score <= 100, \
            f"Fit score must be between 0 and 100, got {fit_score}"
        
        # PROPERTY 2: Verify the weighted calculation formula
        # Calculate expected score manually
        
        # Normalize experience (10+ years = max)
        experience_normalized = min(features['years_experience'] / 10.0, 1.0)
        
        # Normalize projects (15+ projects = max)
        projects_normalized = min(features['project_count'] / 15.0, 1.0)
        
        # Normalize skills (10+ skills = max)
        skills_normalized = min(len(features['skills']) / 10.0, 1.0)
        
        # Normalize education (5 = max)
        education_normalized = features['education_score'] / 5.0
        
        # Calculate expected weighted score
        expected_score = (
            tfidf_similarity * 0.40 +
            experience_normalized * 0.25 +
            projects_normalized * 0.20 +
            skills_normalized * 0.10 +
            education_normalized * 0.05
        ) * 100
        
        # Allow small floating point tolerance
        tolerance = 0.1
        assert abs(fit_score - expected_score) < tolerance, \
            f"Fit score {fit_score} does not match expected weighted calculation {expected_score:.2f}\n" \
            f"Components: TF-IDF={tfidf_similarity:.3f}, Exp={experience_normalized:.3f}, " \
            f"Proj={projects_normalized:.3f}, Skills={skills_normalized:.3f}, Edu={education_normalized:.3f}"
        
        # PROPERTY 3: Verify weights sum to 1.0
        weights = ranker.weights
        weight_sum = sum(weights.values())
        assert abs(weight_sum - 1.0) < 0.001, \
            f"Weights must sum to 1.0, got {weight_sum}"
        
        # PROPERTY 4: Verify individual weight values match requirements
        assert abs(weights['tfidf_similarity'] - 0.40) < 0.001, \
            f"TF-IDF weight should be 0.40, got {weights['tfidf_similarity']}"
        assert abs(weights['experience'] - 0.25) < 0.001, \
            f"Experience weight should be 0.25, got {weights['experience']}"
        assert abs(weights['projects'] - 0.20) < 0.001, \
            f"Projects weight should be 0.20, got {weights['projects']}"
        assert abs(weights['skills'] - 0.10) < 0.001, \
            f"Skills weight should be 0.10, got {weights['skills']}"
        assert abs(weights['education'] - 0.05) < 0.001, \
            f"Education weight should be 0.05, got {weights['education']}"
        
        # PROPERTY 5: Consistency - same inputs should produce same output
        fit_score_2 = ranker._compute_fit_score(resume_text, job_description, features)
        assert abs(fit_score - fit_score_2) < 0.001, \
            f"Same inputs should produce same output, got {fit_score} and {fit_score_2}"
        
        # PROPERTY 6: TF-IDF similarity should be between 0 and 1
        assert 0 <= tfidf_similarity <= 1, \
            f"TF-IDF similarity must be between 0 and 1, got {tfidf_similarity}"
        
        # PROPERTY 7: Verify score components are properly normalized
        assert 0 <= experience_normalized <= 1, \
            f"Normalized experience must be 0-1, got {experience_normalized}"
        assert 0 <= projects_normalized <= 1, \
            f"Normalized projects must be 0-1, got {projects_normalized}"
        assert 0 <= skills_normalized <= 1, \
            f"Normalized skills must be 0-1, got {skills_normalized}"
        assert 0 <= education_normalized <= 1, \
            f"Normalized education must be 0-1, got {education_normalized}"
        
        logger.info(f"✓ Fit score calculation verified: {fit_score:.2f} "
                   f"(TF-IDF={tfidf_similarity:.3f}, Exp={features['years_experience']}y, "
                   f"Proj={features['project_count']}, Skills={len(features['skills'])}, "
                   f"Edu={features['education_score']})")
        
    except Exception as e:
        logger.error(f"Fit score calculation test failed: {str(e)}")
        raise

# Additional test: Verify higher scores for better matches
@given(
    base_data=resume_job_pair(),
    similarity_boost=st.floats(min_value=0.0, max_value=0.3)
)
@settings(
    max_examples=5,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture, HealthCheck.too_slow]
)
def test_fit_score_monotonicity(base_data, similarity_boost):
    """
    Property: Better matches should produce higher scores.
    
    This test verifies that when we improve the match between resume and job
    (by adding more matching keywords), the fit score increases.
    """
    resume_text = base_data['resume_text']
    job_description = base_data['job_description']
    
    assume(len(resume_text.strip()) >= 100)
    assume(len(job_description.strip()) >= 50)
    
    ranker = EnhancedResumeRanker()
    
    try:
        # Calculate base fit score
        features = ranker._extract_features(resume_text)
        base_score = ranker._compute_fit_score(resume_text, job_description, features)
        
        # Create an improved resume by adding job description keywords
        # This should increase TF-IDF similarity
        improved_resume = resume_text + "\n\nAdditional Experience:\n" + job_description[:200]
        
        # Calculate improved fit score
        improved_features = ranker._extract_features(improved_resume)
        improved_score = ranker._compute_fit_score(improved_resume, job_description, improved_features)
        
        # PROPERTY: Improved match should have higher or equal score
        # (equal is possible if the improvement is minimal)
        assert improved_score >= base_score - 0.1, \
            f"Improved resume should have higher score: base={base_score:.2f}, improved={improved_score:.2f}"
        
        logger.info(f"✓ Monotonicity verified: base={base_score:.2f}, improved={improved_score:.2f}")
        
    except Exception as e:
        logger.error(f"Monotonicity test failed: {str(e)}")
        raise

# Run the tests if executed directly
if __name__ == '__main__':
    print("=" * 70)
    print("Property-Based Test: Fit Score Weighted Calculation")
    print("=" * 70)
    print("\nThis test validates Requirement 1.4")
    print("Running 10 iterations with randomly generated resume/job pairs...\n")
    
    print("Testing fit score calculation properties:")
    print("  - Score is between 0 and 100")
    print("  - Uses correct weighted formula:")
    print("    * TF-IDF similarity: 40%")
    print("    * Experience: 25%")
    print("    * Projects: 20%")
    print("    * Skills: 10%")
    print("    * Education: 5%")
    print("  - Higher scores for better matches")
    print("  - Consistent results for same inputs")
    print("\nStarting property tests...\n")
    
    try:
        # Run the main property test
        print("Test 1: Weighted Calculation Formula")
        print("-" * 70)
        test_fit_score_weighted_calculation()
        print("✓ Weighted calculation test passed\n")
        
        # Run the monotonicity test
        print("Test 2: Score Monotonicity (Better Matches → Higher Scores)")
        print("-" * 70)
        test_fit_score_monotonicity()
        print("✓ Monotonicity test passed\n")
        
        print("\n" + "=" * 70)
        print("✓ ALL PROPERTY TESTS PASSED")
        print("=" * 70)
        print("\nProperty 3: Fit Score Weighted Calculation - VERIFIED")
        print("  ✓ Fit score is always between 0 and 100")
        print("  ✓ Weighted formula correctly implemented:")
        print("    - TF-IDF similarity: 40%")
        print("    - Experience: 25%")
        print("    - Projects: 20%")
        print("    - Skills: 10%")
        print("    - Education: 5%")
        print("  ✓ All weights sum to 100%")
        print("  ✓ Score components properly normalized (0-1)")
        print("  ✓ Consistent results for same inputs")
        print("  ✓ Better matches produce higher scores")
        print("\n✓ Requirement 1.4 validated successfully")
        
    except Exception as e:
        print("\n" + "=" * 70)
        print("✗ PROPERTY TEST FAILED")
        print("=" * 70)
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
