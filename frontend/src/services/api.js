import axios from "axios";
import toast from "react-hot-toast";

const BASE_URL = "http://localhost:4000/api/v1";

// Create axios instance with defaults
const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Response interceptor for global error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            if (error.response.status === 401) {
                window.location.href = "/login";
            }
            const message = error.response.data?.message || "Something went wrong";
            if (error.response.status >= 500) {
                toast.error("Server error. Please try again later.");
            }
            return Promise.reject({ ...error, userMessage: message });
        }
        if (error.request) {
            toast.error("Network error. Please check your connection.");
        }
        return Promise.reject(error);
    }
);

// ============================================
// Dashboard Service Functions (Task 2.2)
// ============================================

export const dashboardService = {
    getCandidates: (jobId, params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.sortBy) queryParams.set("sortBy", params.sortBy);
        if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);
        if (params.filterStatus) queryParams.set("filterStatus", params.filterStatus);
        if (params.filterInterview) queryParams.set("filterInterview", params.filterInterview);
        const qs = queryParams.toString();
        return api.get(`/dashboard/candidates/${jobId}${qs ? `?${qs}` : ""}`);
    },

    getActivityLog: (jobId, params = {}) => {
        const queryParams = new URLSearchParams();
        if (params.limit) queryParams.set("limit", params.limit);
        if (params.offset) queryParams.set("offset", params.offset);
        if (params.action_type) queryParams.set("action_type", params.action_type);
        if (params.startDate) queryParams.set("startDate", params.startDate);
        if (params.endDate) queryParams.set("endDate", params.endDate);
        const qs = queryParams.toString();
        return api.get(`/dashboard/activity-log/${jobId}${qs ? `?${qs}` : ""}`);
    },

    getAnalytics: (jobId) => {
        return api.get(`/dashboard/analytics/${jobId}`);
    },
};

// ============================================
// Job Service Functions (Task 2.3)
// ============================================

export const jobService = {
    postJob: (data) => {
        return api.post("/job/post", data);
    },

    getMyJobs: () => {
        return api.get("/job/getmyjobs");
    },

    getSingleJob: (jobId) => {
        return api.get(`/job/${jobId}`);
    },

    closeApplications: (jobId) => {
        return api.put(`/job/update/${jobId}`, { expired: true });
    },

    startAutomation: (jobId) => {
        // The backend automation is triggered via existing endpoints
        return api.post(`/job/post`, { jobId, triggerAutomation: true });
    },
};

// ============================================
// Interview Service Functions (Task 2.4)
// ============================================

export const interviewService = {
    getSlots: (interviewId) => {
        return api.get(`/interview/available-slots/${interviewId}`);
    },

    selectSlot: (interviewId, selectedSlot) => {
        return api.post(`/interview/select-slot/${interviewId}`, { selectedSlot });
    },

    confirmSlot: (interviewId) => {
        return api.post(`/interview/confirm-slot/${interviewId}`);
    },
};

export default api;
