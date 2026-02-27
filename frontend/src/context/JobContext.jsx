import React, { createContext, useContext, useState, useCallback } from "react";
import { jobService } from "../services/api";
import toast from "react-hot-toast";

const JobContext = createContext(null);

export const useJobContext = () => {
    const context = useContext(JobContext);
    if (!context) {
        throw new Error("useJobContext must be used within a JobProvider");
    }
    return context;
};

export const JobProvider = ({ children }) => {
    const [selectedJob, setSelectedJob] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await jobService.getMyJobs();
            setJobs(data.myJobs || []);
        } catch (err) {
            setError(err.userMessage || "Failed to fetch jobs");
            toast.error("Failed to fetch jobs");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchJobDetails = useCallback(async (jobId) => {
        setLoading(true);
        try {
            const { data } = await jobService.getSingleJob(jobId);
            setSelectedJob(data.job);
        } catch (err) {
            toast.error("Failed to fetch job details");
        } finally {
            setLoading(false);
        }
    }, []);

    const closeApplications = useCallback(async (jobId) => {
        try {
            await jobService.closeApplications(jobId);
            toast.success("Applications closed successfully!");
            if (selectedJob && selectedJob.id === jobId) {
                setSelectedJob((prev) => ({ ...prev, expired: true }));
            }
            setJobs((prev) =>
                prev.map((j) => (j.id === jobId ? { ...j, expired: true } : j))
            );
            return true;
        } catch (err) {
            toast.error(err.userMessage || "Failed to close applications");
            return false;
        }
    }, [selectedJob]);

    return (
        <JobContext.Provider
            value={{
                selectedJob,
                setSelectedJob,
                jobs,
                setJobs,
                loading,
                error,
                fetchJobs,
                fetchJobDetails,
                closeApplications,
            }}
        >
            {children}
        </JobContext.Provider>
    );
};

export default JobContext;
