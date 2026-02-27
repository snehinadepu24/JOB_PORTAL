"""
Unit tests for NoShowRiskAnalyzer
Tests the risk scoring algorithm and individual risk factor calculations
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock, patch
from no_show_risk_analyzer import NoShowRiskAnalyzer


class TestNoShowRiskAnalyzer:
    """Test suite for NoShowRiskAnalyzer"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.analyzer = NoShowRiskAnalyzer()
    
    def test_weights_sum_to_one(self):
        """Test that risk factor weights sum to 1.0"""
        total_weight = sum(self.analyzer.weights.values())
        assert abs(total_weight - 1.0) < 0.001, "Weights should sum to 1.0"
    
    def test_categorize_risk_low(self):
        """Test risk categorization for low risk scores"""
        assert self.analyzer._categorize_risk(0.0) == 'low'
        assert self.analyzer._categorize_risk(0.15) == 'low'
        assert self.analyzer._categorize_risk(0.29) == 'low'
    
    def test_categorize_risk_medium(self):
        """Test risk categorization for medium risk scores"""
        assert self.analyzer._categorize_risk(0.3) == 'medium'
        assert self.analyzer._categorize_risk(0.5) == 'medium'
        assert self.analyzer._categorize_risk(0.69) == 'medium'
    
    def test_categorize_risk_high(self):
        """Test risk categorization for high risk scores"""
        assert self.analyzer._categorize_risk(0.7) == 'high'
        assert self.analyzer._categorize_risk(0.85) == 'high'
        assert self.analyzer._categorize_risk(1.0) == 'high'
    
    def test_response_time_risk_fast_response(self):
        """Test response time risk for fast responses (< 6 hours)"""
        interview = {
            'status': 'slot_pending',
            'created_at': datetime.now() - timedelta(hours=3),
            'updated_at': datetime.now()
        }
        risk = self.analyzer._calculate_response_time_risk(interview)
        assert risk == 0.1, "Fast response should have low risk"
    
    def test_response_time_risk_medium_response(self):
        """Test response time risk for medium responses (6-24 hours)"""
        interview = {
            'status': 'slot_pending',
            'created_at': datetime.now() - timedelta(hours=12),
            'updated_at': datetime.now()
        }
        risk = self.analyzer._calculate_response_time_risk(interview)
        assert risk == 0.3, "Medium response time should have medium risk"
    
    def test_response_time_risk_slow_response(self):
        """Test response time risk for slow responses (24-48 hours)"""
        interview = {
            'status': 'slot_pending',
            'created_at': datetime.now() - timedelta(hours=36),
            'updated_at': datetime.now()
        }
        risk = self.analyzer._calculate_response_time_risk(interview)
        assert risk == 0.7, "Slow response should have high risk"
    
    def test_response_time_risk_very_slow_response(self):
        """Test response time risk for very slow responses (> 48 hours)"""
        interview = {
            'status': 'slot_pending',
            'created_at': datetime.now() - timedelta(hours=60),
            'updated_at': datetime.now()
        }
        risk = self.analyzer._calculate_response_time_risk(interview)
        assert risk == 0.9, "Very slow response should have very high risk"
    
    def test_response_time_risk_no_response(self):
        """Test response time risk when candidate hasn't responded yet"""
        interview = {
            'status': 'invitation_sent',
            'created_at': datetime.now() - timedelta(hours=12),
            'updated_at': datetime.now()
        }
        risk = self.analyzer._calculate_response_time_risk(interview)
        assert risk == 0.5, "No response should have medium risk"
    
    def test_profile_completeness_risk_complete_profile(self):
        """Test profile completeness risk for complete profiles"""
        candidate = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'phone': '+1234567890'
        }
        application = {
            'cover_letter': 'This is a detailed cover letter with meaningful content.',
            'address': '123 Main St, City, State 12345',
            'resume_url': 'https://example.com/resume.pdf'
        }
        risk = self.analyzer._calculate_profile_completeness_risk(candidate, application)
        assert risk == 0.0, "Complete profile should have zero risk"
    
    def test_profile_completeness_risk_incomplete_profile(self):
        """Test profile completeness risk for incomplete profiles"""
        candidate = {
            'name': 'John Doe',
            'email': 'john@example.com',
            'phone': None
        }
        application = {
            'cover_letter': None,
            'address': '123 Main St',
            'resume_url': 'https://example.com/resume.pdf'
        }
        risk = self.analyzer._calculate_profile_completeness_risk(candidate, application)
        # 4 out of 6 fields complete = 2/6 missing = 0.33 risk
        assert 0.3 <= risk <= 0.4, "Incomplete profile should have medium risk"
    
    def test_profile_completeness_risk_minimal_profile(self):
        """Test profile completeness risk for minimal profiles"""
        candidate = {
            'name': 'John Doe',
            'email': None,
            'phone': None
        }
        application = {
            'cover_letter': None,
            'address': None,
            'resume_url': 'https://example.com/resume.pdf'
        }
        risk = self.analyzer._calculate_profile_completeness_risk(candidate, application)
        # Only 2 out of 6 fields complete = 4/6 missing = 0.67 risk
        assert 0.6 <= risk <= 0.7, "Minimal profile should have high risk"
    
    def test_get_response_time_hours(self):
        """Test response time calculation in hours"""
        interview = {
            'status': 'slot_pending',
            'created_at': datetime.now() - timedelta(hours=12, minutes=30),
            'updated_at': datetime.now()
        }
        hours = self.analyzer._get_response_time_hours(interview)
        assert 12.0 <= hours <= 13.0, "Should calculate response time correctly"
    
    def test_get_response_time_hours_no_response(self):
        """Test response time for interviews without response"""
        interview = {
            'status': 'invitation_sent',
            'created_at': datetime.now() - timedelta(hours=12),
            'updated_at': datetime.now()
        }
        hours = self.analyzer._get_response_time_hours(interview)
        assert hours == 0.0, "No response should return 0 hours"
    
    def test_get_negotiation_rounds_from_risk(self):
        """Test negotiation rounds estimation from risk score"""
        assert self.analyzer._get_negotiation_rounds_from_risk(0.1) == 0
        assert self.analyzer._get_negotiation_rounds_from_risk(0.2) == 1
        assert self.analyzer._get_negotiation_rounds_from_risk(0.5) == 2
        assert self.analyzer._get_negotiation_rounds_from_risk(0.8) == 3
    
    @patch('no_show_risk_analyzer.NoShowRiskAnalyzer._get_db_connection')
    def test_analyze_risk_integration(self, mock_db_conn):
        """Test full risk analysis integration"""
        # Mock database connection and cursor
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_conn.return_value = mock_conn
        
        # Mock interview data
        interview_data = {
            'id': 'interview-123',
            'application_id': 'app-123',
            'job_id': 'job-123',
            'recruiter_id': 'recruiter-123',
            'candidate_id': 'candidate-123',
            'status': 'slot_pending',
            'created_at': datetime.now() - timedelta(hours=12),
            'updated_at': datetime.now(),
            'confirmation_deadline': None,
            'slot_selection_deadline': None,
            'scheduled_time': None
        }
        
        # Mock candidate data
        candidate_data = {
            'id': 'candidate-123',
            'name': 'John Doe',
            'email': 'john@example.com',
            'phone': '+1234567890',
            'created_at': datetime.now() - timedelta(days=30)
        }
        
        # Mock application data
        application_data = {
            'id': 'app-123',
            'applicant_id': 'candidate-123',
            'job_id': 'job-123',
            'cover_letter': 'This is a detailed cover letter.',
            'address': '123 Main St',
            'resume_url': 'https://example.com/resume.pdf',
            'created_at': datetime.now() - timedelta(days=5)
        }
        
        # Set up cursor to return mock data
        mock_cursor.fetchone.side_effect = [
            interview_data,  # First call: get interview
            candidate_data,  # Second call: get candidate
            application_data,  # Third call: get application
            None,  # Fourth call: get negotiation (none exists)
            []  # Fifth call: get historical interviews (none exist)
        ]
        
        # Execute analysis
        result = self.analyzer.analyze_risk('interview-123', 'candidate-123')
        
        # Verify result structure
        assert 'no_show_risk' in result
        assert 'risk_level' in result
        assert 'factors' in result
        
        # Verify risk score is in valid range
        assert 0.0 <= result['no_show_risk'] <= 1.0
        
        # Verify risk level is valid
        assert result['risk_level'] in ['low', 'medium', 'high']
        
        # Verify factors are present
        assert 'response_time_hours' in result['factors']
        assert 'negotiation_rounds' in result['factors']
        assert 'profile_completeness' in result['factors']
        assert 'historical_reliability' in result['factors']
        
        # Verify database connection was closed
        mock_cursor.close.assert_called_once()
        mock_conn.close.assert_called_once()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
