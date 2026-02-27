"""
Enhanced Resume Ranker with AI Summary Generation
Extends base resume ranking with extractive summarization
"""
import re
import requests
import logging
from io import BytesIO
from typing import Dict, List, Tuple
from PyPDF2 import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import nltk

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

from nltk.tokenize import sent_tokenize
from nltk.corpus import stopwords

logger = logging.getLogger(__name__)

class EnhancedResumeRanker:
    """
    Enhanced resume ranking system with AI-powered summary generation.
    Uses TF-IDF for scoring and extractive summarization for profile summaries.
    """
    
    def __init__(self):
        """Initialize the resume ranker with TF-IDF vectorizer"""
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.stop_words = set(stopwords.words('english'))
        
        # Scoring weights (as per requirements)
        self.weights = {
            'tfidf_similarity': 0.40,
            'experience': 0.25,
            'projects': 0.20,
            'skills': 0.10,
            'education': 0.05
        }
    
    def process_application(self, application_id: str, resume_url: str, job_description: str) -> Dict:
        """
        Main entry point: process a resume and return all extracted data
        
        Args:
            application_id: UUID of the application
            resume_url: Cloudinary URL of the resume PDF
            job_description: Job description text for matching
            
        Returns:
            Dictionary with fit_score, summary, and extracted_features
        """
        try:
            # Download and parse resume
            resume_text = self._download_and_parse_resume(resume_url)
            
            if not resume_text or len(resume_text.strip()) < 50:
                raise ValueError("Resume text is empty or too short")
            
            # Extract features
            features = self._extract_features(resume_text)
            
            # Generate summary
            summary = self.generate_summary(resume_text, max_length=200)
            
            # Compute fit score
            fit_score = self._compute_fit_score(resume_text, job_description, features)
            
            return {
                'success': True,
                'fit_score': round(fit_score, 2),
                'summary': summary,
                'extracted_features': features
            }
            
        except Exception as e:
            logger.error(f"Error processing application {application_id}: {str(e)}")
            # Return error state as per requirements (fit_score=0)
            return {
                'success': False,
                'fit_score': 0.0,
                'summary': '',
                'extracted_features': {
                    'skills': [],
                    'years_experience': 0,
                    'project_count': 0,
                    'education_score': 0
                },
                'error': str(e)
            }
    
    def generate_summary(self, resume_text: str, max_length: int = 200) -> str:
        """
        Generate an extractive summary of the resume using TF-IDF sentence scoring.
        
        This method:
        1. Splits resume into sentences
        2. Scores each sentence using TF-IDF
        3. Selects top-scoring sentences
        4. Returns a concise summary within max_length
        
        Args:
            resume_text: Full text extracted from resume
            max_length: Maximum character length of summary (default: 200)
            
        Returns:
            Concise summary string
        """
        try:
            # Clean and normalize text
            text = self._clean_text(resume_text)
            
            if not text or len(text.strip()) < 50:
                return "Resume content too short to summarize."
            
            # Split into sentences
            sentences = sent_tokenize(text)
            
            if len(sentences) == 0:
                return "Unable to extract meaningful content from resume."
            
            # If only 1-2 sentences, return them directly
            if len(sentences) <= 2:
                summary = ' '.join(sentences)
                return summary[:max_length] + ('...' if len(summary) > max_length else '')
            
            # Score sentences using TF-IDF
            sentence_scores = self._score_sentences(sentences)
            
            # Select top sentences
            summary_sentences = self._select_top_sentences(sentences, sentence_scores, max_length)
            
            # Join and return
            summary = ' '.join(summary_sentences)
            
            # Ensure we don't exceed max_length
            if len(summary) > max_length:
                summary = summary[:max_length].rsplit(' ', 1)[0] + '...'
            
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return "Error generating resume summary."
    
    def _score_sentences(self, sentences: List[str]) -> np.ndarray:
        """
        Score sentences using TF-IDF vectorization.
        
        Args:
            sentences: List of sentence strings
            
        Returns:
            Array of scores for each sentence
        """
        try:
            # Create TF-IDF matrix
            tfidf_matrix = self.vectorizer.fit_transform(sentences)
            
            # Calculate sentence scores as sum of TF-IDF values
            sentence_scores = np.asarray(tfidf_matrix.sum(axis=1)).flatten()
            
            return sentence_scores
            
        except Exception as e:
            logger.error(f"Error scoring sentences: {str(e)}")
            # Return uniform scores if TF-IDF fails
            return np.ones(len(sentences))
    
    def _select_top_sentences(self, sentences: List[str], scores: np.ndarray, max_length: int) -> List[str]:
        """
        Select top-scoring sentences that fit within max_length.
        
        Args:
            sentences: List of sentence strings
            scores: Array of sentence scores
            max_length: Maximum total character length
            
        Returns:
            List of selected sentences in original order
        """
        # Get sentence indices sorted by score (descending)
        ranked_indices = np.argsort(scores)[::-1]
        
        selected_sentences = []
        current_length = 0
        
        # Select sentences greedily by score until we hit max_length
        for idx in ranked_indices:
            sentence = sentences[idx]
            sentence_length = len(sentence)
            
            # Check if adding this sentence would exceed max_length
            if current_length + sentence_length + 1 <= max_length:  # +1 for space
                selected_sentences.append((idx, sentence))
                current_length += sentence_length + 1
            
            # Stop if we have at least 2 sentences and are close to max_length
            if len(selected_sentences) >= 2 and current_length > max_length * 0.8:
                break
        
        # Sort selected sentences by original order
        selected_sentences.sort(key=lambda x: x[0])
        
        # Return just the sentence text
        return [sent for _, sent in selected_sentences]
    
    def _download_and_parse_resume(self, resume_url: str) -> str:
        """
        Download resume PDF from URL and extract text.
        
        Args:
            resume_url: URL to resume PDF
            
        Returns:
            Extracted text from PDF
        """
        try:
            # Download PDF
            response = requests.get(resume_url, timeout=30)
            response.raise_for_status()
            
            # Parse PDF
            pdf_file = BytesIO(response.content)
            pdf_reader = PdfReader(pdf_file)
            
            # Extract text from all pages
            text = ''
            for page in pdf_reader.pages:
                text += page.extract_text() + '\n'
            
            return text
            
        except Exception as e:
            logger.error(f"Error downloading/parsing resume from {resume_url}: {str(e)}")
            raise
    
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text for processing.
        
        Args:
            text: Raw text
            
        Returns:
            Cleaned text
        """
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters but keep periods for sentence splitting
        text = re.sub(r'[^\w\s\.]', ' ', text)
        
        # Remove multiple periods
        text = re.sub(r'\.+', '.', text)
        
        return text.strip()
    
    def _extract_features(self, resume_text: str) -> Dict:
        """
        Extract structured features from resume text.
        
        Args:
            resume_text: Full resume text
            
        Returns:
            Dictionary with skills, years_experience, project_count, education_score
        """
        features = {
            'skills': self._extract_skills(resume_text),
            'years_experience': self._extract_experience(resume_text),
            'project_count': self._extract_project_count(resume_text),
            'education_score': self._extract_education_score(resume_text)
        }
        
        return features
    
    def _extract_skills(self, text: str) -> List[str]:
        """Extract technical skills from resume text"""
        # Common technical skills to look for
        skill_keywords = [
            'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
            'node', 'express', 'django', 'flask', 'spring', 'sql', 'nosql',
            'mongodb', 'postgresql', 'mysql', 'redis', 'aws', 'azure', 'gcp',
            'docker', 'kubernetes', 'git', 'ci/cd', 'agile', 'scrum',
            'machine learning', 'deep learning', 'ai', 'data science',
            'html', 'css', 'rest', 'api', 'microservices'
        ]
        
        text_lower = text.lower()
        found_skills = []
        
        for skill in skill_keywords:
            if skill in text_lower:
                found_skills.append(skill.title())
        
        return found_skills
    
    def _extract_experience(self, text: str) -> int:
        """Extract years of experience from resume text"""
        # Look for patterns like "5 years", "5+ years", "5-7 years"
        patterns = [
            r'(\d+)\+?\s*years?\s+(?:of\s+)?experience',
            r'experience\s+(?:of\s+)?(\d+)\+?\s*years?',
            r'(\d+)\+?\s*years?\s+in'
        ]
        
        text_lower = text.lower()
        max_years = 0
        
        for pattern in patterns:
            matches = re.findall(pattern, text_lower)
            for match in matches:
                years = int(match)
                max_years = max(max_years, years)
        
        return max_years
    
    def _extract_project_count(self, text: str) -> int:
        """Estimate number of projects from resume text"""
        # Look for project-related keywords
        project_keywords = ['project', 'developed', 'built', 'created', 'implemented']
        
        text_lower = text.lower()
        count = 0
        
        for keyword in project_keywords:
            count += text_lower.count(keyword)
        
        # Normalize: assume each mention roughly corresponds to a project
        # Cap at reasonable maximum
        return min(count, 20)
    
    def _extract_education_score(self, text: str) -> int:
        """
        Score education level from resume text.
        Returns: 1-5 scale (1=High School, 2=Associate, 3=Bachelor, 4=Master, 5=PhD)
        """
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['phd', 'ph.d', 'doctorate']):
            return 5
        elif any(word in text_lower for word in ['master', 'msc', 'm.sc', 'mba', 'm.b.a']):
            return 4
        elif any(word in text_lower for word in ['bachelor', 'bsc', 'b.sc', 'ba', 'b.a', 'bs', 'b.s']):
            return 3
        elif any(word in text_lower for word in ['associate', 'diploma']):
            return 2
        elif any(word in text_lower for word in ['high school', 'secondary']):
            return 1
        else:
            return 0
    
    def _compute_fit_score(self, resume_text: str, job_description: str, features: Dict) -> float:
        """
        Compute weighted fit score based on TF-IDF similarity and extracted features.
        
        Scoring formula (as per requirements):
        - TF-IDF similarity: 40%
        - Experience: 25%
        - Projects: 20%
        - Skills: 10%
        - Education: 5%
        
        Args:
            resume_text: Full resume text
            job_description: Job description text
            features: Extracted features dictionary
            
        Returns:
            Fit score (0-100)
        """
        try:
            # 1. TF-IDF Similarity (40%)
            tfidf_score = self._compute_tfidf_similarity(resume_text, job_description)
            
            # 2. Experience Score (25%)
            # Normalize years to 0-1 scale (assume 10+ years = max)
            experience_score = min(features['years_experience'] / 10.0, 1.0)
            
            # 3. Project Score (20%)
            # Normalize project count to 0-1 scale (assume 15+ projects = max)
            project_score = min(features['project_count'] / 15.0, 1.0)
            
            # 4. Skills Score (10%)
            # Normalize skill count to 0-1 scale (assume 10+ skills = max)
            skills_score = min(len(features['skills']) / 10.0, 1.0)
            
            # 5. Education Score (5%)
            # Normalize education to 0-1 scale (5 = max)
            education_score = features['education_score'] / 5.0
            
            # Weighted combination
            fit_score = (
                tfidf_score * self.weights['tfidf_similarity'] +
                experience_score * self.weights['experience'] +
                project_score * self.weights['projects'] +
                skills_score * self.weights['skills'] +
                education_score * self.weights['education']
            )
            
            # Scale to 0-100
            return fit_score * 100
            
        except Exception as e:
            logger.error(f"Error computing fit score: {str(e)}")
            return 0.0
    
    def _compute_tfidf_similarity(self, resume_text: str, job_description: str) -> float:
        """
        Compute cosine similarity between resume and job description using TF-IDF.
        
        Args:
            resume_text: Resume text
            job_description: Job description text
            
        Returns:
            Similarity score (0-1)
        """
        try:
            # Create TF-IDF vectors
            documents = [resume_text, job_description]
            tfidf_matrix = self.vectorizer.fit_transform(documents)
            
            # Compute cosine similarity
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error computing TF-IDF similarity: {str(e)}")
            return 0.0
