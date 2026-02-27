"""
Property-Based Tests for Risk Score Range

**Validates: Requirements 7.3**

Property 24: Risk Score Range
For any interview risk analysis, the computed no_show_risk score should be 
between 0.0 and 1.0 inclusive.
"""
import os
import sys
import logging
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from hypothesis import given, settings, strategies as st, assume, HealthCheck
from hypothesis.strategies import composite

from no_show_risk_analyzer import NoShowRiskAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Strategy for generating interview data
@composite
def interview_data(draw):
    """
    Generate realistic interview data for risk analysis testing.
    Returns interview, candidate, and application dictionaries.
    """
    # Generate response time (0-72 hours)
    response_hours = draw(st.integers(min_value=0, max_value=72))
    
    # Generate interview status
    statuses = ['invitation_sent', 'slot_pending', 'confirmed']
    status = draw(st.sampled_from(statuses))
    
    # Create timestamps based on response time
    created_at = datetime.now() - timedelta(hours=response_hours + 1)
    updated_at = datetime.now() - timedelta(hours=1) if status != 'invitation_sent' else created_at
    
    interview = {
        'id': 'test-interview-id',
        'application_id': 'test-app-id',
        'job_id': 'test-job-id',
        'recruiter_id': 'test-recruiter-id',
        'candidate_id': 'test-candidate-id',
        'status': status,
        'created_at': created_at,
        'updated_at': updated_at,
        'confirmation_deadline': None,
        'slot_selection_deadline': None,
        'scheduled_time': None
    }
    
    # Generate candidate data with varying completeness
    has_name = draw(st.booleans())
    has_email = draw(st.booleans())
    has_phone = draw(st.booleans())
    
    candidate = {
        'id': 'test-candidate-id',
        'name': 'John Doe' if has_name else None,
        'email': 'john@example.com' if has_email else None,
        'phone': '+1234567890' if has_phone else None,
        'created_at': datetime.now() - timedelta(days=30)
    }
    
    # Generate application data with varying completeness
    has_cover_letter = draw(st.booleans())
    has_address = draw(st.booleans())
    has_resume = draw(st.booleans())
    
    application = {
        'id': 'test-app-id',
        'applicant_id': 'test-candidate-id',
        'job_id': 'test-job-id',
        'cover_letter': 'This is a detailed cover letter with meaningful content.' if has_cover_letter else None,
        'address': '123 Main St, City, State 12345' if has_address else None,
        'resume_url': 'https://example.com/resume.pdf' if has_resume else None,
        'created_at': datetime.now() - timedelta(days=5)
    }
    
    # Generate negotiation data
    negotiation_rounds = draw(st.integers(min_value=0, max_value=5))
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    } if negotiation_rounds > 0 else None
    
    # Generate historical interview data
    num_past_interviews = draw(st.integers(min_value=0, max_value=10))
    past_interviews = []
    
    if num_past_interviews > 0:
        for _ in range(num_past_interviews):
            past_status = draw(st.sampled_from(['completed', 'no_show', 'cancelled']))
            past_interviews.append({'status': past_status})
    
    return {
        'interview': interview,
        'candidate': candidate,
        'application': application,
        'negotiation': negotiation,
        'past_interviews': past_interviews
    }


@given(data=interview_data())
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_risk_score_range_property(data):
    """
    Property 24: Risk Score Range
    
    **Validates: Requirements 7.3**
    
    For any combination of interview factors (response time, negotiation complexity,
    profile completeness, historical patterns), the computed no_show_risk score
    should always be between 0.0 and 1.0 inclusive.
    
    This property ensures that the risk scoring algorithm never produces invalid
    scores regardless of input variations.
    """
    analyzer = NoShowRiskAnalyzer()
    
    # Mock database connection and cursor
    with patch('no_show_risk_analyzer.NoShowRiskAnalyzer._get_db_connection') as mock_db_conn:
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_conn.return_value = mock_conn
        
        # Set up cursor to return mock data
        mock_cursor.fetchone.side_effect = [
            data['interview'],  # First call: get interview
            data['candidate'],  # Second call: get candidate
            data['application'],  # Third call: get application
            data['negotiation'],  # Fourth call: get negotiation
        ]
        
        # Set up fetchall for historical interviews
        mock_cursor.fetchall.return_value = data['past_interviews']
        
        # Execute risk analysis
        result = analyzer.analyze_risk('test-interview-id', 'test-candidate-id')
        
        # Property assertion: Risk score must be in valid range [0.0, 1.0]
        risk_score = result['no_show_risk']
        assert 0.0 <= risk_score <= 1.0, \
            f"Risk score {risk_score} is outside valid range [0.0, 1.0]"
        
        # Additional invariants
        assert isinstance(risk_score, (int, float)), \
            f"Risk score must be numeric, got {type(risk_score)}"
        
        # Verify risk level is consistent with score
        # Note: The implementation rounds to 2 decimal places, so we need to check
        # the categorization based on the actual implementation logic
        risk_level = result['risk_level']
        assert risk_level in ['low', 'medium', 'high'], \
            f"Risk level must be 'low', 'medium', or 'high', got '{risk_level}'"
        
        # Verify categorization is reasonable (allowing for rounding at boundaries)
        if risk_score < 0.29:
            assert risk_level == 'low', \
                f"Risk score {risk_score} should be categorized as 'low', got '{risk_level}'"
        elif risk_score > 0.71:
            assert risk_level == 'high', \
                f"Risk score {risk_score} should be categorized as 'high', got '{risk_level}'"
        # For boundary cases (0.29-0.31 and 0.69-0.71), allow either category due to rounding


@given(
    response_hours=st.floats(min_value=0, max_value=100),
    negotiation_rounds=st.integers(min_value=0, max_value=10),
    profile_fields_complete=st.integers(min_value=0, max_value=6),
    past_no_shows=st.integers(min_value=0, max_value=20),
    past_completed=st.integers(min_value=0, max_value=20)
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_risk_score_range_extreme_inputs(response_hours, negotiation_rounds, 
                                         profile_fields_complete, past_no_shows, 
                                         past_completed):
    """
    Property 24: Risk Score Range (Extreme Inputs)
    
    **Validates: Requirements 7.3**
    
    Test risk score range with extreme and edge case inputs to ensure
    the algorithm handles unusual scenarios gracefully and still produces
    valid scores in the [0.0, 1.0] range.
    """
    analyzer = NoShowRiskAnalyzer()
    
    # Create interview with extreme response time
    created_at = datetime.now() - timedelta(hours=response_hours + 1)
    updated_at = datetime.now() - timedelta(hours=1)
    
    interview = {
        'id': 'test-interview-id',
        'application_id': 'test-app-id',
        'job_id': 'test-job-id',
        'recruiter_id': 'test-recruiter-id',
        'candidate_id': 'test-candidate-id',
        'status': 'slot_pending',
        'created_at': created_at,
        'updated_at': updated_at,
        'confirmation_deadline': None,
        'slot_selection_deadline': None,
        'scheduled_time': None
    }
    
    # Create candidate and application with controlled completeness
    # Distribute fields across candidate and application
    candidate_fields = min(profile_fields_complete, 3)
    app_fields = min(profile_fields_complete - candidate_fields, 3)
    
    candidate = {
        'id': 'test-candidate-id',
        'name': 'John Doe' if candidate_fields > 0 else None,
        'email': 'john@example.com' if candidate_fields > 1 else None,
        'phone': '+1234567890' if candidate_fields > 2 else None,
        'created_at': datetime.now() - timedelta(days=30)
    }
    
    application = {
        'id': 'test-app-id',
        'applicant_id': 'test-candidate-id',
        'job_id': 'test-job-id',
        'cover_letter': 'Detailed cover letter content here.' if app_fields > 0 else None,
        'address': '123 Main St, City, State' if app_fields > 1 else None,
        'resume_url': 'https://example.com/resume.pdf' if app_fields > 2 else None,
        'created_at': datetime.now() - timedelta(days=5)
    }
    
    # Create negotiation data
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    } if negotiation_rounds > 0 else None
    
    # Create historical interview data
    past_interviews = []
    for _ in range(past_no_shows):
        past_interviews.append({'status': 'no_show'})
    for _ in range(past_completed):
        past_interviews.append({'status': 'completed'})
    
    # Mock database connection
    with patch('no_show_risk_analyzer.NoShowRiskAnalyzer._get_db_connection') as mock_db_conn:
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_conn.return_value = mock_conn
        
        # Set up cursor to return mock data
        mock_cursor.fetchone.side_effect = [
            interview,
            candidate,
            application,
            negotiation,
        ]
        
        mock_cursor.fetchall.return_value = past_interviews
        
        # Execute risk analysis
        result = analyzer.analyze_risk('test-interview-id', 'test-candidate-id')
        
        # Property assertion: Risk score must be in valid range
        risk_score = result['no_show_risk']
        assert 0.0 <= risk_score <= 1.0, \
            f"Risk score {risk_score} is outside valid range [0.0, 1.0] with extreme inputs"
        
        # Verify result structure
        assert 'risk_level' in result
        assert 'factors' in result
        assert result['risk_level'] in ['low', 'medium', 'high']


if __name__ == '__main__':
    import pytest
    pytest.main([__file__, '-v', '-s'])
