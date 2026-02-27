# Configuration Guide

This directory contains environment configuration for the AI Hiring Orchestrator backend.

## Configuration File

The `config.env` file contains all environment variables required by the application.

## Environment Variables

### Server Configuration
- `PORT`: Server port (default: 4000)
- `FRONTEND_URL`: Frontend application URL for CORS

### Database Configuration
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key for client operations
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for admin operations

### Authentication
- `JWT_SECRET_KEY`: Secret key for JWT token generation
- `JWT_EXPIRE`: JWT token expiration time (e.g., "7d")
- `COOKIE_EXPIRE`: Cookie expiration in days

### File Storage
- `CLOUDINARY_API_KEY`: Cloudinary API key for resume storage
- `CLOUDINARY_API_SECRET`: Cloudinary API secret
- `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name

### Email Configuration (Optional)
- `EMAIL_HOST`: SMTP server host (e.g., smtp.gmail.com)
- `EMAIL_PORT`: SMTP server port (e.g., 587)
- `EMAIL_USER`: Email account username
- `EMAIL_PASSWORD`: Email account password or app-specific password

### Google Calendar Integration (Optional)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth callback URL

### Gemini LLM Configuration
Configuration for Google's Gemini LLM integration with the NegotiationBot for enhanced natural language understanding.

- `GEMINI_API_KEY`: **Required** - Your Google Gemini API key
  - Obtain from: https://makersuite.google.com/app/apikey
  - Used for authenticating with Gemini API
  - Keep this secret and never commit to version control

- `GEMINI_MODEL_NAME`: Model to use (default: "gemini-1.5-flash")
  - Options: "gemini-1.5-flash", "gemini-1.5-pro"
  - Flash model is faster and more cost-effective
  - Pro model provides higher quality responses

- `GEMINI_TIMEOUT_MS`: API request timeout in milliseconds (default: 10000)
  - Recommended: 10000 (10 seconds)
  - System falls back to regex parsing if timeout is exceeded

#### Getting a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key
5. Add it to `config.env` as `GEMINI_API_KEY=your-key-here`

#### Feature Flags

Gemini features are controlled by feature flags in the database:
- `gemini_enabled`: Master flag for all Gemini features
- `gemini_parsing`: Enable Gemini-powered availability parsing
- `gemini_responses`: Enable Gemini-powered response generation

These flags support percentage-based rollout for gradual deployment.

#### Fallback Behavior

If Gemini API is unavailable or returns errors:
- Availability parsing falls back to regex-based pattern matching
- Response generation falls back to template-based responses
- System continues to function with reduced natural language capabilities

## Security Notes

1. **Never commit config.env to version control** - It contains sensitive credentials
2. Use environment-specific configuration files for different deployments
3. Rotate API keys and secrets periodically
4. Use app-specific passwords for email accounts
5. Restrict API key permissions to minimum required scope

## Setup Instructions

1. Copy `config.env.example` to `config.env` (if example exists)
2. Fill in all required values
3. Ensure the file is listed in `.gitignore`
4. Restart the server after making changes

## Troubleshooting

### Gemini API Issues

**Error: "GEMINI_API_KEY environment variable is required"**
- Ensure `GEMINI_API_KEY` is set in `config.env`
- Verify the server has been restarted after adding the key

**Error: "Authentication failed" (401)**
- Verify your API key is correct
- Check if the API key has been revoked or expired
- Ensure you have API access enabled in Google AI Studio

**Timeout errors**
- Increase `GEMINI_TIMEOUT_MS` if needed
- Check your network connectivity
- System will automatically fall back to regex parsing

**Rate limit errors (429)**
- Gemini API has rate limits based on your tier
- System implements exponential backoff automatically
- Consider upgrading your API tier if needed

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check network connectivity to Supabase
- Ensure your IP is not blocked by Supabase

### Email Issues
- For Gmail, use app-specific passwords instead of account password
- Enable "Less secure app access" if using regular password (not recommended)
- Verify SMTP settings match your email provider

## Environment-Specific Configuration

For production deployments, use environment variables directly instead of the config.env file:

```bash
export GEMINI_API_KEY=your-production-key
export SUPABASE_URL=your-production-url
# ... other variables
```

Or use a secrets management service like AWS Secrets Manager, HashiCorp Vault, or similar.
