"""
No-Show Risk Analyzer for AI Hiring Orchestrator
Predicts candidate no-show probability based on behavioral patterns
"""
import os
import logging
from typing import Dict, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class NoShowRiskAnalyzer:
    """
    Analyzes candidate behavior patterns to predict interview no-show risk.
    
    Risk Scoring Algorithm:
    - Response time risk: 30% weight
    - Negotiation complexity risk: 25% weight
    - Profile completeness risk: 20% weight
    - Historical pattern risk: 25% weight
    
    Risk Score Range: 0.0 (very reliable) to 1.0 (high risk)
    Risk Categories:
    - Low: 0.0 - 0.3
    - Medium: 0.3 - 0.7
    - High: 0.7 - 1.0
    """
    
    def __init__(self):
        """Initialize the risk analyzer with scoring weights"""
        self.weights = {
            'response_time': 0.30,
            'negotiation_complexity': 0.25,
            'profile_completeness': 0.20,
            'historical_pattern': 0.25
        }
    
    def analyze_risk(self, interview_id: str, candidate_id: str) -> Dict:
        """
        Analyze no-show risk for a candidate's interview.
        
        Args:
            interview_id: UUID of the interview
            candidate_id: UUID of the candidate
            
        Returns:
            Dictionary with:
            - no_show_risk: float (0.0-1.0)
            - risk_level: str ('low', 'medium', 'high')
            - factors: dict with individual risk factor scores
        """
        try:
            # Get database connection
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Fetch interview data
            interview = self._get_interview(cursor, interview_id)
            if not interview:
                raise ValueError(f"Interview {interview_id} not found")
            
            # Fetch candidate data
            candidate = self._get_candidate(cursor, candidate_id)
            if not candidate:
                raise ValueError(f"Candidate {candidate_id} not found")
            
            # Fetch application data
            application = self._get_application(cursor, interview['application_id'])
            if not application:
                raise ValueError(f"Application {interview['application_id']} not found")
            
            # Calculate individual risk factors
            response_risk = self._calculate_response_time_risk(interview)
            negotiation_risk = self._calculate_negotiation_risk(cursor, interview_id)
            profile_risk = self._calculate_profile_completeness_risk(candidate, application)
            historical_risk = self._calculate_historical_risk(cursor, candidate_id)
            
            # Compute weighted total risk
            total_risk = (
                response_risk * self.weights['response_time'] +
                negotiation_risk * self.weights['negotiation_complexity'] +
                profile_risk * self.weights['profile_completeness'] +
                historical_risk * self.weights['historical_pattern']
            )
            
            # Close database connection
            cursor.close()
            conn.close()
            
            # Calculate response time in hours for reporting
            response_time_hours = self._get_response_time_hours(interview)
            negotiation_rounds = self._get_negotiation_rounds_from_risk(negotiation_risk)
            
            return {
                'no_show_risk': round(total_risk, 2),
                'risk_level': self._categorize_risk(total_risk),
                'factors': {
                    'response_time_hours': response_time_hours,
                    'negotiation_rounds': negotiation_rounds,
                    'profile_completeness': round(1 - profile_risk, 2),
                    'historical_reliability': round(1 - historical_risk, 2)
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing risk for interview {interview_id}: {str(e)}")
            raise
    
    def _get_db_connection(self):
        """Get database connection from environment variables"""
        # Try DATABASE_URL first
        db_url = os.getenv('DATABASE_URL')
        if db_url:
            return psycopg2.connect(db_url)
        
        # Try Supabase URL
        supabase_url = os.getenv('SUPABASE_URL')
        if supabase_url:
            project_ref = supabase_url.replace('https://', '').replace('.supabase.co', '')
            db_password = os.getenv('SUPABASE_DB_PASSWORD', '')
            if db_password:
                return psycopg2.connect(
                    host=f'db.{project_ref}.supabase.co',
                    port='5432',
                    database='postgres',
                    user='postgres',
                    password=db_password
                )
        
        # Fallback to individual parameters
        return psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'postgres'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
    
    def _get_interview(self, cursor, interview_id: str) -> Optional[Dict]:
        """Fetch interview record from database"""
        cursor.execute("""
            SELECT id, application_id, job_id, recruiter_id, candidate_id,
                   status, created_at, updated_at, confirmation_deadline,
                   slot_selection_deadline, scheduled_time
            FROM interviews
            WHERE id = %s
        """, (interview_id,))
        return cursor.fetchone()
    
    def _get_candidate(self, cursor, candidate_id: str) -> Optional[Dict]:
        """Fetch candidate (user) record from database"""
        cursor.execute("""
            SELECT id, name, email, phone, created_at
            FROM users
            WHERE id = %s
        """, (candidate_id,))
        return cursor.fetchone()
    
    def _get_application(self, cursor, application_id: str) -> Optional[Dict]:
        """Fetch application record from database"""
        cursor.execute("""
            SELECT id, applicant_id, job_id, cover_letter, address,
                   resume_url, created_at
            FROM applications
            WHERE id = %s
        """, (application_id,))
        return cursor.fetchone()
    
    def _calculate_response_time_risk(self, interview: Dict) -> float:
        """
        Calculate risk based on response time to invitation.
        
        Risk increases with delay:
        - 0-6 hours: low risk (0.1)
        - 6-24 hours: medium risk (0.3)
        - 24-48 hours: high risk (0.7)
        - >48 hours: very high risk (0.9)
        - Not yet responded: medium risk (0.5)
        
        Args:
            interview: Interview record dictionary
            
        Returns:
            Risk score (0.0-1.0)
        """
        status = interview['status']
        
        # If still waiting for response
        if status == 'invitation_sent':
            return 0.5
        
        # Calculate time between invitation and response
        created_at = interview['created_at']
        updated_at = interview['updated_at']
        
        if not created_at or not updated_at:
            return 0.5
        
        # Calculate hours elapsed
        time_diff = updated_at - created_at
        hours_elapsed = time_diff.total_seconds() / 3600
        
        # Risk increases with delay
        if hours_elapsed < 6:
            return 0.1
        elif hours_elapsed < 24:
            return 0.3
        elif hours_elapsed < 48:
            return 0.7
        else:
            return 0.9
    
    def _calculate_negotiation_risk(self, cursor, interview_id: str) -> float:
        """
        Calculate risk based on negotiation complexity.
        
        More negotiation rounds indicate higher risk:
        - No negotiation: low risk (0.1)
        - 1 round: low-medium risk (0.2)
        - 2 rounds: medium-high risk (0.5)
        - 3+ rounds: high risk (0.8)
        
        Args:
            cursor: Database cursor
            interview_id: Interview UUID
            
        Returns:
            Risk score (0.0-1.0)
        """
        try:
            cursor.execute("""
                SELECT round, state
                FROM negotiation_sessions
                WHERE interview_id = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (interview_id,))
            
            negotiation = cursor.fetchone()
            
            if not negotiation:
                # No negotiation needed = low risk
                return 0.1
            
            rounds = negotiation['round']
            
            # More rounds = higher risk
            if rounds == 1:
                return 0.2
            elif rounds == 2:
                return 0.5
            else:
                return 0.8
                
        except Exception as e:
            logger.warning(f"Error fetching negotiation data: {str(e)}")
            return 0.1
    
    def _calculate_profile_completeness_risk(self, candidate: Dict, application: Dict) -> float:
        """
        Calculate risk based on profile completeness.
        
        Lower completeness = higher risk
        Checks: name, email, phone, cover_letter, address, resume_url
        
        Args:
            candidate: Candidate (user) record
            application: Application record
            
        Returns:
            Risk score (0.0-1.0)
        """
        completeness_score = 0
        total_fields = 0
        
        # User profile fields
        profile_fields = ['name', 'email', 'phone']
        for field in profile_fields:
            total_fields += 1
            if candidate.get(field) and len(str(candidate[field])) > 0:
                completeness_score += 1
        
        # Application fields
        app_fields = ['cover_letter', 'address', 'resume_url']
        for field in app_fields:
            total_fields += 1
            value = application.get(field)
            if value and len(str(value)) > 10:  # Meaningful content
                completeness_score += 1
        
        # Calculate completeness ratio
        completeness_ratio = completeness_score / total_fields if total_fields > 0 else 0
        
        # Lower completeness = higher risk
        return 1 - completeness_ratio
    
    def _calculate_historical_risk(self, cursor, candidate_id: str) -> float:
        """
        Calculate risk based on candidate's past interview history.
        
        Analyzes:
        - Past no-show rate
        - Past completion rate
        
        Args:
            cursor: Database cursor
            candidate_id: Candidate UUID
            
        Returns:
            Risk score (0.0-1.0)
        """
        try:
            cursor.execute("""
                SELECT status
                FROM interviews
                WHERE candidate_id = %s
                  AND id != (SELECT id FROM interviews WHERE candidate_id = %s ORDER BY created_at DESC LIMIT 1)
                  AND status IN ('completed', 'no_show', 'cancelled')
            """, (candidate_id, candidate_id))
            
            past_interviews = cursor.fetchall()
            
            if not past_interviews or len(past_interviews) == 0:
                # No history = medium risk
                return 0.5
            
            total = len(past_interviews)
            no_shows = sum(1 for i in past_interviews if i['status'] == 'no_show')
            completed = sum(1 for i in past_interviews if i['status'] == 'completed')
            
            # Calculate reliability metrics
            no_show_rate = no_shows / total
            completion_rate = completed / total
            
            # High no-show rate = high risk
            # Low completion rate = higher risk
            risk = no_show_rate + (1 - completion_rate) * 0.5
            
            return min(risk, 1.0)
            
        except Exception as e:
            logger.warning(f"Error fetching historical data: {str(e)}")
            return 0.5
    
    def _categorize_risk(self, risk_score: float) -> str:
        """
        Categorize risk score into low/medium/high.
        
        Args:
            risk_score: Risk score (0.0-1.0)
            
        Returns:
            Risk category: 'low', 'medium', or 'high'
        """
        if risk_score < 0.3:
            return 'low'
        elif risk_score < 0.7:
            return 'medium'
        else:
            return 'high'
    
    def _get_response_time_hours(self, interview: Dict) -> float:
        """Calculate response time in hours for reporting"""
        status = interview['status']
        
        if status == 'invitation_sent':
            return 0.0
        
        created_at = interview['created_at']
        updated_at = interview['updated_at']
        
        if not created_at or not updated_at:
            return 0.0
        
        time_diff = updated_at - created_at
        return round(time_diff.total_seconds() / 3600, 1)
    
    def _get_negotiation_rounds_from_risk(self, negotiation_risk: float) -> int:
        """Estimate negotiation rounds from risk score"""
        if negotiation_risk <= 0.1:
            return 0
        elif negotiation_risk <= 0.2:
            return 1
        elif negotiation_risk <= 0.5:
            return 2
        else:
            return 3
