import express from "express";
import "./database/supabaseClient.js";
import jobRouter from "./routes/jobRoutes.js";
import userRouter from "./routes/userRoutes.js";
import applicationRouter from "./routes/applicationRoutes.js";
import calendarRouter from "./routes/calendarRoutes.js";
import interviewRouter from "./routes/interviewRoutes.js";
import { config } from "dotenv";
import cors from "cors";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";

const app = express();

// Configure dotenv first
config({ path: "./config/config.env" });

// Verify environment variables are loaded
if (!process.env.PORT || !process.env.FRONTEND_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Critical environment variables are missing!");
  process.exit(1);
}

// Configure CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    abortOnLimit: true,
    debug: true // Enable debug mode for troubleshooting
  })
);

// Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/job", jobRouter);
app.use("/api/v1/application", applicationRouter);
app.use("/api/v1/calendar", calendarRouter);
app.use("/api/v1/interview", interviewRouter);

// Error middleware
app.use(errorMiddleware);

export default app;
