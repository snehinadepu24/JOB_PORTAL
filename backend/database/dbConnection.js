import mongoose from "mongoose";
import { config } from "dotenv";

// Configure dotenv with the correct path
config({ path: "./config/config.env" });

const dbConnection = () => {
  mongoose
    .connect(process.env.DB_URL, {
      dbName: "Job_Portal",
    })
    .then(() => {
      console.log("MongoDB Connected Successfully!");
      // Log the connection URL (without sensitive data) to verify
      console.log("Connected to database:", process.env.DB_URL.split('@')[1]);
    })
    .catch((error) => {
      console.log(`Failed to connect: ${error}`);
    });
};

export default dbConnection;
