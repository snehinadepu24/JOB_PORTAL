export const verifyEnvironment = () => {
  const requiredEnvVars = [
    'PORT',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'FRONTEND_URL',
    'DB_URL',
    'JWT_SECRET_KEY',
    'JWT_EXPIRE',
    'COOKIE_EXPIRE'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    return false;
  }

  return true;
};