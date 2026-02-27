import app from "./app.js";
import cloudinary from "cloudinary";
import { config } from "dotenv";

// Configure dotenv
config({ path: "./config/config.env" });

// Configure cloudinary with proper settings
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Test Cloudinary configuration
try {
  const testResult = await cloudinary.v2.api.ping();
  console.log("Cloudinary connection successful:", testResult.status);
  
  // Log Cloudinary configuration for debugging (without sensitive data)
  console.log("Cloudinary configuration:", {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? "Set" : "Not set",
    api_secret: process.env.CLOUDINARY_API_SECRET ? "Set" : "Not set"
  });
  
  // Test if we can list resources
  const resources = await cloudinary.v2.api.resources({
    resource_type: 'raw',
    type: 'upload',
    max_results: 1
  });
  console.log("Cloudinary resources test:", resources.resources.length > 0 ? "Success" : "No resources found");
  
} catch (error) {
  console.error("Cloudinary connection error:", error);
}

// Log environment variables (without sensitive data) to verify they're loaded
console.log("Environment Configuration:");
console.log("PORT:", process.env.PORT);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("JWT_EXPIRE:", process.env.JWT_EXPIRE);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});
