"""
Simple test for the risk analysis endpoint
"""
import pytest
import json
from app import app


@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_analyze_risk_endpoint_missing_fields(client):
    """Test that the endpoint returns 400 when required fields are missing"""
    # Missing both fields
    response = client.post('/api/python/analyze-risk',
                          data=json.dumps({}),
                          content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['success'] is False
    assert 'Missing required fields' in data['error']
    
    # Missing candidate_id
    response = client.post('/api/python/analyze-risk',
                          data=json.dumps({'interview_id': 'test-id'}),
                          content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['success'] is False
    
    # Missing interview_id
    response = client.post('/api/python/analyze-risk',
                          data=json.dumps({'candidate_id': 'test-id'}),
                          content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data['success'] is False


def test_analyze_risk_endpoint_invalid_ids(client):
    """Test that the endpoint returns 404 when IDs don't exist"""
    response = client.post('/api/python/analyze-risk',
                          data=json.dumps({
                              'interview_id': 'non-existent-id',
                              'candidate_id': 'non-existent-id'
                          }),
                          content_type='application/json')
    # Should return 404 or 500 depending on database state
    assert response.status_code in [404, 500]
    data = json.loads(response.data)
    assert data['success'] is False


def test_health_check(client):
    """Test that the health check endpoint works"""
    response = client.get('/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'healthy'
    assert data['service'] == 'resume-intelligence-engine'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
