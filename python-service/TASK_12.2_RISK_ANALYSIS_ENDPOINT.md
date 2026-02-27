# Task 12.2: Risk Analysis Endpoint Implementation

## Summary

Added `/api/python/analyze-risk` POST endpoint to the Python Flask service to expose the NoShowRiskAnalyzer functionality via HTTP API.

## Implementation Details

### Endpoint: POST /api/python/analyze-risk

**Request Body:**
```json
{
  "interview_id": "uuid",
  "candidate_id": "uuid"
}
```

**Response (Success - 200):**
```json
{
  "no_show_risk": 0.35,
  "risk_level": "medium",
  "factors": {
    "response_time_hours": 12.0,
    "negotiation_rounds": 1,
    "profile_completeness": 0.9,
    "historical_reliability": 0.8
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "Missing required fields: interview_id, candidate_id"
}
```

**Response (Not Found - 404):**
```json
{
  "success": false,
  "error": "Interview {id} not found"
}
```

**Response (Server Error - 500):**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Features

1. **Input Validation**: Validates that both `interview_id` and `candidate_id` are provided
2. **Error Handling**: 
   - Returns 400 for missing fields
   - Returns 404 for non-existent records (ValueError)
   - Returns 500 for other errors
3. **Logging**: Logs all requests and results for debugging
4. **Integration**: Uses the existing `NoShowRiskAnalyzer` class from Task 12.1

## Risk Analysis

The endpoint calls `NoShowRiskAnalyzer.analyze_risk()` which computes:

- **no_show_risk**: Float between 0.0 (very reliable) and 1.0 (high risk)
- **risk_level**: Categorized as 'low' (0-0.3), 'medium' (0.3-0.7), or 'high' (0.7-1.0)
- **factors**: Individual risk components:
  - `response_time_hours`: Hours taken to respond to invitation
  - `negotiation_rounds`: Number of negotiation rounds (0-3+)
  - `profile_completeness`: Profile completeness score (0-1)
  - `historical_reliability`: Historical reliability score (0-1)

## Testing

Created `test_risk_analysis_endpoint.py` with tests for:
- Missing required fields (returns 400)
- Invalid IDs (returns 404/500)
- Health check endpoint

All tests pass successfully.

## Requirements Validated

- **Requirement 7.1**: Interview risk analysis on confirmation
- **Requirement 7.2**: Risk computed from behavioral patterns
- **Requirement 7.3**: Risk score between 0.0 and 1.0
- **Requirement 7.8**: Risk displayed with color coding (risk_level field)

## Usage Example

```bash
curl -X POST http://localhost:5001/api/python/analyze-risk \
  -H "Content-Type: application/json" \
  -d '{
    "interview_id": "123e4567-e89b-12d3-a456-426614174000",
    "candidate_id": "123e4567-e89b-12d3-a456-426614174001"
  }'
```

## Files Modified

- `python-service/app.py`: Added `/analyze-risk` endpoint and initialized `NoShowRiskAnalyzer`

## Files Created

- `python-service/test_risk_analysis_endpoint.py`: Unit tests for the endpoint
- `python-service/TASK_12.2_RISK_ANALYSIS_ENDPOINT.md`: This documentation

## Next Steps

Task 12.3 will integrate this endpoint into the interview flow by:
1. Calling the risk analyzer when an interview is confirmed
2. Storing the `no_show_risk` in the interview record
3. Adding a risk update task to the background scheduler
