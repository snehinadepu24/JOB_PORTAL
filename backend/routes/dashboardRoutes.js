import express from "express";
import {
  getRankedCandidates,
  getActivityLog,
  getAnalytics
} from "../controllers/dashboardController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

/**
 * Dashboard API Routes
 * Requirements: 9.1, 9.2, 9.5, 9.7
 */

// GET /api/v1/dashboard/candidates/:jobId
// Returns ranked candidates with all required fields
router.get("/candidates/:jobId", isAuthenticated, getRankedCandidates);

// GET /api/v1/dashboard/activity-log/:jobId
// Returns automation activity log entries
router.get("/activity-log/:jobId", isAuthenticated, getActivityLog);

// GET /api/v1/dashboard/analytics/:jobId
// Returns calculated analytics metrics
router.get("/analytics/:jobId", isAuthenticated, getAnalytics);

export default router;
