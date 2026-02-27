import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { dashboardService } from "../services/api";
import toast from "react-hot-toast";

const DashboardContext = createContext(null);

export const useDashboardContext = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error("useDashboardContext must be used within a DashboardProvider");
    }
    return context;
};

export const DashboardProvider = ({ children }) => {
    // Candidates state
    const [candidates, setCandidates] = useState([]);
    const [candidatesMeta, setCandidatesMeta] = useState(null);
    const [candidatesLoading, setCandidatesLoading] = useState(false);

    // Activity log state
    const [activityLog, setActivityLog] = useState([]);
    const [activityLogMeta, setActivityLogMeta] = useState(null);
    const [activityLoading, setActivityLoading] = useState(false);

    // Analytics state
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Filters
    const [candidateFilters, setCandidateFilters] = useState({
        sortBy: "fit_score",
        sortOrder: "desc",
        filterStatus: "",
    });
    const [activityFilters, setActivityFilters] = useState({
        action_type: "",
        startDate: "",
        endDate: "",
        offset: 0,
        limit: 50,
    });

    // Polling
    const [autoRefresh, setAutoRefresh] = useState(false);
    const pollingRef = useRef(null);
    const currentJobIdRef = useRef(null);

    // Cache timestamps
    const cacheRef = useRef({
        analytics: { data: null, timestamp: 0 },
    });

    const fetchCandidates = useCallback(async (jobId, filters = {}) => {
        setCandidatesLoading(true);
        try {
            const { data } = await dashboardService.getCandidates(jobId, {
                ...candidateFilters,
                ...filters,
            });
            setCandidates(data.candidates || []);
            setCandidatesMeta(data.metadata || null);
        } catch (err) {
            toast.error("Failed to fetch candidates");
        } finally {
            setCandidatesLoading(false);
        }
    }, [candidateFilters]);

    const fetchActivityLog = useCallback(async (jobId, filters = {}) => {
        setActivityLoading(true);
        try {
            const { data } = await dashboardService.getActivityLog(jobId, {
                ...activityFilters,
                ...filters,
            });
            setActivityLog(data.logs || []);
            setActivityLogMeta({
                total: data.total,
                limit: data.limit,
                offset: data.offset,
            });
        } catch (err) {
            toast.error("Failed to fetch activity log");
        } finally {
            setActivityLoading(false);
        }
    }, [activityFilters]);

    const fetchAnalytics = useCallback(async (jobId) => {
        // Check cache (2 minutes)
        const cached = cacheRef.current.analytics;
        if (cached.data && Date.now() - cached.timestamp < 120000) {
            setAnalytics(cached.data);
            return;
        }

        setAnalyticsLoading(true);
        try {
            const { data } = await dashboardService.getAnalytics(jobId);
            setAnalytics(data.analytics || data);
            cacheRef.current.analytics = {
                data: data.analytics || data,
                timestamp: Date.now(),
            };
        } catch (err) {
            toast.error("Failed to fetch analytics");
        } finally {
            setAnalyticsLoading(false);
        }
    }, []);

    // Polling logic with visibility API
    useEffect(() => {
        if (!autoRefresh || !currentJobIdRef.current) return;

        const startPolling = () => {
            pollingRef.current = setInterval(() => {
                if (!document.hidden) {
                    fetchActivityLog(currentJobIdRef.current);
                }
            }, 30000);
        };

        startPolling();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (pollingRef.current) clearInterval(pollingRef.current);
            } else {
                startPolling();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [autoRefresh, fetchActivityLog]);

    const setCurrentJobId = useCallback((jobId) => {
        currentJobIdRef.current = jobId;
        // Invalidate cache on job change
        cacheRef.current.analytics = { data: null, timestamp: 0 };
    }, []);

    return (
        <DashboardContext.Provider
            value={{
                candidates,
                candidatesMeta,
                candidatesLoading,
                fetchCandidates,
                candidateFilters,
                setCandidateFilters,

                activityLog,
                activityLogMeta,
                activityLoading,
                fetchActivityLog,
                activityFilters,
                setActivityFilters,

                analytics,
                analyticsLoading,
                fetchAnalytics,

                autoRefresh,
                setAutoRefresh,
                setCurrentJobId,
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
};

export default DashboardContext;
