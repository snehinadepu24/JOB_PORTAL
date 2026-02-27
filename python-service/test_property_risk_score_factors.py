"""
Property-Based Tests for Risk Score Factors

**Validates: Requirements 7.2**

Property 25: Risk Score Factors
When computing risk, the Risk_Analyzer SHALL analyze: response time to invitation,
negotiation rounds, profile completeness, and historical patterns. All four factors
must be considered in the weighted combination, and changing each factor independently
should affect the final risk score.
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


# Strategy for generating controlled interview data
@composite
def controlled_interview_data(draw, 
                               response_hours=None,
                               negotiation_rounds=None,
                               profile_completeness=None,
                               historical_reliability=None):
    """
    Generate interview data with controlled factors for testing.
    Allows fixing specific factors while varying others.
    """
    # Response time (0-72 hours)
    if response_hours is None:
        response_hours = draw(st.integers(min_value=0, max_value=72))
    
    # Interview status (must not be invitation_sent for response time to matter)
    status = 'slot_pending'
    
    # Create timestamps based on response time
    created_at = datetime.now() - timedelta(hours=response_hours + 1)
    updated_at = datetime.now() - timedelta(hours=1)
    
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
    
    # Negotiation rounds (0-5)
    if negotiation_rounds is None:
        negotiation_rounds = draw(st.integers(min_value=0, max_value=5))
    
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    } if negotiation_rounds > 0 else None
    
    # Profile completeness (0-6 fields complete)
    if profile_completeness is None:
        profile_completeness = draw(st.integers(min_value=0, max_value=6))
    
    # Distribute fields across candidate and application
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
    
    # Historical reliability (0.0-1.0)
    if historical_reliability is None:
        historical_reliability = draw(st.floats(min_value=0.0, max_value=1.0))
    
    # Generate past interviews based on reliability
    # Higher reliability = more completed, fewer no-shows
    num_past_interviews = draw(st.integers(min_value=1, max_value=10))
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
        'past_interviews': past_interviews,
        'response_hours': response_hours,
        'negotiation_rounds': negotiation_rounds,
        'profile_completeness': profile_completeness,
        'historical_reliability': historical_reliability
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


@given(data=controlled_interview_data())
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_all_four_factors_considered(data):
    """
    Property 25: Risk Score Factors - All Factors Considered
    
    **Validates: Requirements 7.2**
    
    Verifies that all four risk factors are considered in the risk analysis:
    1. Response time to invitation
    2. Negotiation rounds
    3. Profile completeness
    4. Historical patterns
    
    The test ensures that the factors dictionary in the result contains all
    four required factors with valid values.
    """
    result = run_risk_analysis(data)
    
    # Verify all four factors are present in the result
    assert 'factors' in result, "Result must contain 'factors' dictionary"
    factors = result['factors']
    
    # Check all four required factors are present
    required_factors = [
        'response_time_hours',
        'negotiation_rounds',
        'profile_completeness',
        'historical_reliability'
    ]
    
    for factor in required_factors:
        assert factor in factors, f"Factor '{factor}' must be present in result"
    
    # Verify factor values are in valid ranges
    assert factors['response_time_hours'] >= 0, \
        "Response time hours must be non-negative"
    
    assert factors['negotiation_rounds'] >= 0, \
        "Negotiation rounds must be non-negative"
    
    assert 0.0 <= factors['profile_completeness'] <= 1.0, \
        "Profile completeness must be between 0.0 and 1.0"
    
    assert 0.0 <= factors['historical_reliability'] <= 1.0, \
        "Historical reliability must be between 0.0 and 1.0"


def create_test_data(response_hours, negotiation_rounds, profile_completeness, historical_reliability):
    """Helper to create test data with specific factor values"""
    # Interview status (must not be invitation_sent for response time to matter)
    status = 'slot_pending'
    
    # Create timestamps based on response time
    created_at = datetime.now() - timedelta(hours=response_hours + 1)
    updated_at = datetime.now() - timedelta(hours=1)
    
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
    
    # Negotiation data
    negotiation = {
        'round': negotiation_rounds,
        'state': 'awaiting_selection'
    } if negotiation_rounds > 0 else None
    
    # Profile completeness (0-6 fields complete)
    # Distribute fields across candidate and application
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
    
    # Historical reliability (0.0-1.0)
    # Generate past interviews based on reliability
    # Higher reliability = more completed, fewer no-shows
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
        'past_interviews': past_interviews,
        'response_hours': response_hours,
        'negotiation_rounds': negotiation_rounds,
        'profile_completeness': profile_completeness,
        'historical_reliability': historical_reliability
    }


@given(
    base_response_hours=st.integers(min_value=1, max_value=10),
    varied_response_hours=st.integers(min_value=30, max_value=60)
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_response_time_factor_affects_score(base_response_hours, varied_response_hours):
    """
    Property 25: Risk Score Factors - Response Time Impact
    
    **Validates: Requirements 7.2**
    
    Verifies that changing the response time factor independently affects
    the final risk score. Longer response times should generally increase
    the risk score (with weight 0.30).
    """
    # Assume the two response times are significantly different
    assume(abs(varied_response_hours - base_response_hours) >= 20)
    
    # Create two scenarios with same factors except response time
    fixed_negotiation = 1
    fixed_profile = 4
    fixed_reliability = 0.8
    
    # Scenario 1: Fast response
    data1 = create_test_data(
        response_hours=base_response_hours,
        negotiation_rounds=fixed_negotiation,
        profile_completeness=fixed_profile,
        historical_reliability=fixed_reliability
    )
    
    # Scenario 2: Slow response
    data2 = create_test_data(
        response_hours=varied_response_hours,
        negotiation_rounds=fixed_negotiation,
        profile_completeness=fixed_profile,
        historical_reliability=fixed_reliability
    )
    
    result1 = run_risk_analysis(data1)
    result2 = run_risk_analysis(data2)
    
    score1 = result1['no_show_risk']
    score2 = result2['no_show_risk']
    
    # Longer response time should result in higher risk score
    assert score2 > score1, \
        f"Longer response time ({varied_response_hours}h) should have higher risk " \
        f"than shorter response time ({base_response_hours}h): {score2} vs {score1}"


@given(
    base_negotiation=st.integers(min_value=0, max_value=1),
    varied_negotiation=st.integers(min_value=3, max_value=5)
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_negotiation_factor_affects_score(base_negotiation, varied_negotiation):
    """
    Property 25: Risk Score Factors - Negotiation Complexity Impact
    
    **Validates: Requirements 7.2**
    
    Verifies that changing the negotiation rounds factor independently affects
    the final risk score. More negotiation rounds should increase the risk score
    (with weight 0.25).
    """
    # Create two scenarios with same factors except negotiation rounds
    fixed_response = 10
    fixed_profile = 4
    fixed_reliability = 0.8
    
    # Scenario 1: Few negotiation rounds
    data1 = create_test_data(
        response_hours=fixed_response,
        negotiation_rounds=base_negotiation,
        profile_completeness=fixed_profile,
        historical_reliability=fixed_reliability
    )
    
    # Scenario 2: Many negotiation rounds
    data2 = create_test_data(
        response_hours=fixed_response,
        negotiation_rounds=varied_negotiation,
        profile_completeness=fixed_profile,
        historical_reliability=fixed_reliability
    )
    
    result1 = run_risk_analysis(data1)
    result2 = run_risk_analysis(data2)
    
    score1 = result1['no_show_risk']
    score2 = result2['no_show_risk']
    
    # More negotiation rounds should result in higher risk score
    assert score2 > score1, \
        f"More negotiation rounds ({varied_negotiation}) should have higher risk " \
        f"than fewer rounds ({base_negotiation}): {score2} vs {score1}"


@given(
    base_profile=st.integers(min_value=5, max_value=6),
    varied_profile=st.integers(min_value=0, max_value=2)
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_profile_completeness_factor_affects_score(base_profile, varied_profile):
    """
    Property 25: Risk Score Factors - Profile Completeness Impact
    
    **Validates: Requirements 7.2**
    
    Verifies that changing the profile completeness factor independently affects
    the final risk score. Lower profile completeness should increase the risk score
    (with weight 0.20).
    """
    # Assume significant difference in profile completeness
    assume(abs(varied_profile - base_profile) >= 3)
    
    # Create two scenarios with same factors except profile completeness
    fixed_response = 10
    fixed_negotiation = 1
    fixed_reliability = 0.8
    
    # Scenario 1: Complete profile
    data1 = create_test_data(
        response_hours=fixed_response,
        negotiation_rounds=fixed_negotiation,
        profile_completeness=base_profile,
        historical_reliability=fixed_reliability
    )
    
    # Scenario 2: Incomplete profile
    data2 = create_test_data(
        response_hours=fixed_response,
        negotiation_rounds=fixed_negotiation,
        profile_completeness=varied_profile,
        historical_reliability=fixed_reliability
    )
    
    result1 = run_risk_analysis(data1)
    result2 = run_risk_analysis(data2)
    
    score1 = result1['no_show_risk']
    score2 = result2['no_show_risk']
    
    # Lower profile completeness should result in higher risk score
    assert score2 > score1, \
        f"Lower profile completeness ({varied_profile}/6) should have higher risk " \
        f"than higher completeness ({base_profile}/6): {score2} vs {score1}"


@given(
    base_reliability=st.floats(min_value=0.7, max_value=1.0),
    varied_reliability=st.floats(min_value=0.0, max_value=0.3)
)
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_historical_pattern_factor_affects_score(base_reliability, varied_reliability):
    """
    Property 25: Risk Score Factors - Historical Pattern Impact
    
    **Validates: Requirements 7.2**
    
    Verifies that changing the historical reliability factor independently affects
    the final risk score. Lower historical reliability (more past no-shows) should
    increase the risk score (with weight 0.25).
    """
    # Assume significant difference in reliability
    assume(abs(varied_reliability - base_reliability) >= 0.4)
    
    # Create two scenarios with same factors except historical reliability
    fixed_response = 10
    fixed_negotiation = 1
    fixed_profile = 4
    
    # Scenario 1: High reliability
    data1 = create_test_data(
        response_hours=fixed_response,
        negotiation_rounds=fixed_negotiation,
        profile_completeness=fixed_profile,
        historical_reliability=base_reliability
    )
    
    # Scenario 2: Low reliability
    data2 = create_test_data(
        response_hours=fixed_response,
        negotiation_rounds=fixed_negotiation,
        profile_completeness=fixed_profile,
        historical_reliability=varied_reliability
    )
    
    result1 = run_risk_analysis(data1)
    result2 = run_risk_analysis(data2)
    
    score1 = result1['no_show_risk']
    score2 = result2['no_show_risk']
    
    # Lower historical reliability should result in higher risk score
    assert score2 > score1, \
        f"Lower historical reliability ({varied_reliability:.2f}) should have higher risk " \
        f"than higher reliability ({base_reliability:.2f}): {score2} vs {score1}"


@given(data=controlled_interview_data())
@settings(
    max_examples=3,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_weighted_combination_correctness(data):
    """
    Property 25: Risk Score Factors - Weighted Combination
    
    **Validates: Requirements 7.2**
    
    Verifies that the risk score is computed as a weighted combination of all
    four factors with the correct weights:
    - response_time: 0.30
    - negotiation_complexity: 0.25
    - profile_completeness: 0.20
    - historical_pattern: 0.25
    
    This test validates the mathematical correctness of the weighted formula.
    """
    analyzer = NoShowRiskAnalyzer()
    
    with patch('no_show_risk_analyzer.NoShowRiskAnalyzer._get_db_connection') as mock_db_conn:
        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_conn.return_value = mock_conn
        
        # Set up cursor to return mock data for the main analysis
        mock_cursor.fetchone.side_effect = [
            data['interview'],
            data['candidate'],
            data['application'],
            data['negotiation'],
        ]
        
        mock_cursor.fetchall.return_value = data['past_interviews']
        
        # Execute risk analysis
        result = analyzer.analyze_risk('test-interview-id', 'test-candidate-id')
        
        # Now calculate individual risk factors manually
        # We need to reset the mock for the individual calculations
        response_risk = analyzer._calculate_response_time_risk(data['interview'])
        
        # For negotiation risk, we need to mock the cursor again
        mock_cursor2 = MagicMock()
        mock_cursor2.fetchone.return_value = data['negotiation']
        negotiation_risk = analyzer._calculate_negotiation_risk(mock_cursor2, 'test-interview-id')
        
        profile_risk = analyzer._calculate_profile_completeness_risk(data['candidate'], data['application'])
        
        # For historical risk, mock the cursor again
        mock_cursor3 = MagicMock()
        mock_cursor3.fetchall.return_value = data['past_interviews']
        historical_risk = analyzer._calculate_historical_risk(mock_cursor3, 'test-candidate-id')
        
        # Calculate expected weighted combination
        expected_risk = (
            response_risk * 0.30 +
            negotiation_risk * 0.25 +
            profile_risk * 0.20 +
            historical_risk * 0.25
        )
        
        # Round to 2 decimal places as the implementation does
        expected_risk = round(expected_risk, 2)
        actual_risk = result['no_show_risk']
        
        # Verify the weighted combination is correct (allow small rounding differences)
        assert abs(actual_risk - expected_risk) < 0.02, \
            f"Risk score {actual_risk} does not match expected weighted combination {expected_risk}"
        
        # Verify weights sum to 1.0
        weights = analyzer.weights
        total_weight = sum(weights.values())
        assert abs(total_weight - 1.0) < 0.001, \
            f"Weights must sum to 1.0, got {total_weight}"


if __name__ == '__main__':
    import pytest
    pytest.main([__file__, '-v', '-s'])
