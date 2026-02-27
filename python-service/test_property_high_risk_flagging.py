"""
Property-Based Tests for High Risk Flagging

**Validates: Requirements 7.4, 7.5**

Property 26: High Risk Flagging
For any interview with no_show_risk >= 0.7, the interview should be flagged as 
high risk in the system. For any interview with no_show_risk < 0.7, the interview 
should NOT be flagged as high risk.

Risk categorization logic:
- risk_score < 0.3: 'low'
- 0.3 <= risk_score < 0.7: 'medium'
- risk_score >= 0.7: 'high'
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


@composite
def high_risk_interview_data(draw):
    """
    Generate interview data that should result in high risk scores (>= 0.7).
    Uses combinations of factors that push the risk score above the threshold.
    """
    # Strategy: Use high-risk factors to ensure score >= 0.7
    # Response time: >48 hours = 0.9 risk (weight 0.30 = 0.27 contribution)
    # Negotiation: 3+ rounds = 0.8 risk (weight 0.25 = 0.20 contribution)
    # Profile: 0-1 fields = ~0.83-1.0 risk (weight 0.20 = 0.17-0.20 contribution)
    # Historical: 0% reliability = 1.0 risk (weight 0.25 = 0.25 contribution)
    
    # Use very slow response time (>48 hours)
    response_hours = draw(st.integers(min_value=50, max_value=100))
    
    # Use high negotiation rounds
    negotiation_rounds = draw(st.integers(min_value=3, max_value=5))
    
    # Use low profile completeness
    profile_completeness = draw(st.integers(min_value=0, max_value=2))
    
    # Use low historical reliability
    historical_reliability = draw(st.floats(min_value=0.0, max_value=0.3))
    
    # Create interview with slow response
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
    
    # Negotiation data
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    }
    
    # Incomplete profile
    candidate_fields = min(profile_completeness, 3)
    app_fields = min(profile_completeness - candidate_fields, 3)
    
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
    
    # Poor historical record
    num_past_interviews = 10
    past_interviews = []
    
    num_completed = int(num_past_interviews * historical_reliability)
    num_no_shows = num_past_interviews - num_completed
    
    for _ in range(num_completed):
        past_interviews.append({'status': 'completed'})
    for _ in range(num_no_shows):
        past_interviews.append({'status': 'no_show'})
    
    return {
        'interview': interview,
        'candidate': candidate,
        'application': application,
        'negotiation': negotiation,
        'past_interviews': past_interviews
    }


@composite
def low_risk_interview_data(draw):
    """
    Generate interview data that should result in low risk scores (< 0.7).
    Uses combinations of factors that keep the risk score below the threshold.
    """
    # Strategy: Use low-risk factors to ensure score < 0.7
    # Response time: <6 hours = 0.1 risk (weight 0.30 = 0.03 contribution)
    # Negotiation: 0-1 rounds = 0.1-0.2 risk (weight 0.25 = 0.025-0.05 contribution)
    # Profile: 4-6 fields = 0.0-0.33 risk (weight 0.20 = 0.0-0.067 contribution)
    # Historical: 70-100% reliability = 0.0-0.3 risk (weight 0.25 = 0.0-0.075 contribution)
    
    # Use fast response time (<24 hours)
    response_hours = draw(st.integers(min_value=0, max_value=20))
    
    # Use low negotiation rounds
    negotiation_rounds = draw(st.integers(min_value=0, max_value=1))
    
    # Use high profile completeness
    profile_completeness = draw(st.integers(min_value=4, max_value=6))
    
    # Use high historical reliability
    historical_reliability = draw(st.floats(min_value=0.7, max_value=1.0))
    
    # Create interview with fast response
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
    
    # Negotiation data
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    } if negotiation_rounds > 0 else None
    
    # Complete profile
    candidate_fields = min(profile_completeness, 3)
    app_fields = min(profile_completeness - candidate_fields, 3)
    
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
    
    # Good historical record
    num_past_interviews = 10
    past_interviews = []
    
    num_completed = int(num_past_interviews * historical_reliability)
    num_no_shows = num_past_interviews - num_completed
    
    for _ in range(num_completed):
        past_interviews.append({'status': 'completed'})
    for _ in range(num_no_shows):
        past_interviews.append({'status': 'no_show'})
    
    return {
        'interview': interview,
        'candidate': candidate,
        'application': application,
        'negotiation': negotiation,
        'past_interviews': past_interviews
    }


def run_risk_analysis(data):
    """Helper function to run risk analysis with mocked database"""
    analyzer = NoShowRiskAnalyzer()
    
    with patch('no_show_risk_analyzer.NoShowRiskAnalyzer._get_db_connection') as mock_db_conn:
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_conn.return_value = mock_conn
        
        # Set up cursor to return mock data
        mock_cursor.fetchone.side_effect = [
            data['interview'],
            data['candidate'],
            data['application'],
            data['negotiation'],
        ]
        
        mock_cursor.fetchall.return_value = data['past_interviews']
        
        # Execute risk analysis
        result = analyzer.analyze_risk('test-interview-id', 'test-candidate-id')
        
        return result


@given(data=high_risk_interview_data())
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_high_risk_flagging_above_threshold(data):
    """
    Property 26: High Risk Flagging - Scores >= 0.7 Flagged as High
    
    **Validates: Requirements 7.4, 7.5**
    
    For any interview with risk factors that produce a no_show_risk score >= 0.7,
    the system MUST flag the interview as "high risk" by setting risk_level to 'high'.
    
    This ensures that high-risk interviews are properly identified and can display
    warning indicators to recruiters.
    """
    result = run_risk_analysis(data)
    
    risk_score = result['no_show_risk']
    risk_level = result['risk_level']
    
    # Property assertion: If risk score >= 0.7, must be flagged as 'high'
    if risk_score >= 0.7:
        assert risk_level == 'high', \
            f"Interview with risk score {risk_score} (>= 0.7) must be flagged as 'high', " \
            f"but got '{risk_level}'"
    
    # Additional verification: High risk interviews should have risk_level in result
    assert 'risk_level' in result, \
        "Result must contain 'risk_level' field for high risk flagging"
    
    # Verify risk_level is one of the valid categories
    assert risk_level in ['low', 'medium', 'high'], \
        f"Risk level must be 'low', 'medium', or 'high', got '{risk_level}'"


@given(data=low_risk_interview_data())
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_high_risk_flagging_below_threshold(data):
    """
    Property 26: High Risk Flagging - Scores < 0.7 NOT Flagged as High
    
    **Validates: Requirements 7.4, 7.5**
    
    For any interview with risk factors that produce a no_show_risk score < 0.7,
    the system MUST NOT flag the interview as "high risk". The risk_level should
    be either 'low' or 'medium'.
    
    This ensures that only truly high-risk interviews trigger warning indicators
    to recruiters, avoiding false alarms.
    """
    result = run_risk_analysis(data)
    
    risk_score = result['no_show_risk']
    risk_level = result['risk_level']
    
    # Property assertion: If risk score < 0.7, must NOT be flagged as 'high'
    if risk_score < 0.7:
        assert risk_level != 'high', \
            f"Interview with risk score {risk_score} (< 0.7) must NOT be flagged as 'high', " \
            f"but got '{risk_level}'"
        
        # Should be either 'low' or 'medium'
        assert risk_level in ['low', 'medium'], \
            f"Interview with risk score {risk_score} (< 0.7) should be 'low' or 'medium', " \
            f"got '{risk_level}'"


@given(risk_score=st.floats(min_value=0.0, max_value=1.0))
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_high_risk_threshold_boundary(risk_score):
    """
    Property 26: High Risk Flagging - Threshold Boundary at 0.7
    
    **Validates: Requirements 7.4, 7.5**
    
    Tests the exact boundary condition at risk_score = 0.7. This verifies that:
    - Scores exactly at 0.7 are flagged as 'high'
    - Scores just below 0.7 are NOT flagged as 'high'
    - The threshold is correctly implemented as >= 0.7 (not > 0.7)
    """
    analyzer = NoShowRiskAnalyzer()
    
    # Test the categorization function directly
    risk_level = analyzer._categorize_risk(risk_score)
    
    # Property assertion: Verify correct categorization based on thresholds
    if risk_score < 0.3:
        assert risk_level == 'low', \
            f"Risk score {risk_score} (< 0.3) should be categorized as 'low', got '{risk_level}'"
    elif risk_score < 0.7:
        assert risk_level == 'medium', \
            f"Risk score {risk_score} (0.3 <= score < 0.7) should be categorized as 'medium', got '{risk_level}'"
    else:  # risk_score >= 0.7
        assert risk_level == 'high', \
            f"Risk score {risk_score} (>= 0.7) should be categorized as 'high', got '{risk_level}'"


@given(
    # Generate scores around the 0.7 boundary
    risk_score=st.one_of(
        st.floats(min_value=0.69, max_value=0.70),  # Just below threshold
        st.floats(min_value=0.70, max_value=0.71)   # Just above threshold
    )
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_high_risk_threshold_precision(risk_score):
    """
    Property 26: High Risk Flagging - Threshold Precision
    
    **Validates: Requirements 7.4, 7.5**
    
    Tests the precision of the 0.7 threshold with scores very close to the boundary.
    This ensures that the threshold is correctly implemented with proper comparison
    operators and handles floating-point precision correctly.
    """
    analyzer = NoShowRiskAnalyzer()
    
    # Test the categorization function directly
    risk_level = analyzer._categorize_risk(risk_score)
    
    # Property assertion: Verify correct categorization at boundary
    if risk_score < 0.7:
        assert risk_level == 'medium', \
            f"Risk score {risk_score} (< 0.7) should be 'medium', got '{risk_level}'"
    else:  # risk_score >= 0.7
        assert risk_level == 'high', \
            f"Risk score {risk_score} (>= 0.7) should be 'high', got '{risk_level}'"


@given(data=high_risk_interview_data())
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_high_risk_flagging_consistency(data):
    """
    Property 26: High Risk Flagging - Consistency
    
    **Validates: Requirements 7.4, 7.5**
    
    Verifies that the risk_level field is always consistent with the no_show_risk
    score. The categorization should be deterministic and follow the defined rules:
    - risk_score < 0.3: 'low'
    - 0.3 <= risk_score < 0.7: 'medium'
    - risk_score >= 0.7: 'high'
    """
    result = run_risk_analysis(data)
    
    risk_score = result['no_show_risk']
    risk_level = result['risk_level']
    
    # Verify consistency between score and level
    if risk_score < 0.3:
        expected_level = 'low'
    elif risk_score < 0.7:
        expected_level = 'medium'
    else:
        expected_level = 'high'
    
    assert risk_level == expected_level, \
        f"Risk level '{risk_level}' is inconsistent with risk score {risk_score}. " \
        f"Expected '{expected_level}'"


@given(
    response_hours=st.integers(min_value=50, max_value=100),
    negotiation_rounds=st.integers(min_value=3, max_value=5),
    profile_completeness=st.integers(min_value=0, max_value=1),
    historical_reliability=st.floats(min_value=0.0, max_value=0.2)
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_high_risk_flagging_extreme_cases(response_hours, negotiation_rounds, 
                                          profile_completeness, historical_reliability):
    """
    Property 26: High Risk Flagging - Extreme High Risk Cases
    
    **Validates: Requirements 7.4, 7.5**
    
    Tests extreme cases where all risk factors are at their worst values.
    These should always result in high risk flagging (risk_level = 'high').
    
    Extreme high risk factors:
    - Very slow response (>48 hours)
    - Many negotiation rounds (3+)
    - Incomplete profile (0-1 fields)
    - Poor historical reliability (0-20%)
    """
    # Create interview with extreme high-risk factors
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
    
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    }
    
    candidate_fields = min(profile_completeness, 3)
    app_fields = min(profile_completeness - candidate_fields, 3)
    
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
    
    num_past_interviews = 10
    past_interviews = []
    
    num_completed = int(num_past_interviews * historical_reliability)
    num_no_shows = num_past_interviews - num_completed
    
    for _ in range(num_completed):
        past_interviews.append({'status': 'completed'})
    for _ in range(num_no_shows):
        past_interviews.append({'status': 'no_show'})
    
    data = {
        'interview': interview,
        'candidate': candidate,
        'application': application,
        'negotiation': negotiation,
        'past_interviews': past_interviews
    }
    
    result = run_risk_analysis(data)
    
    risk_score = result['no_show_risk']
    risk_level = result['risk_level']
    
    # With all extreme high-risk factors, score should be >= 0.7
    assert risk_score >= 0.7, \
        f"Extreme high-risk factors should produce risk score >= 0.7, got {risk_score}"
    
    # And should be flagged as 'high'
    assert risk_level == 'high', \
        f"Extreme high-risk factors should be flagged as 'high', got '{risk_level}'"


if __name__ == '__main__':
    import pytest
    pytest.main([__file__, '-v', '-s'])
