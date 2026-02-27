import React, { useEffect, useState } from "react";
import { useJobContext } from "../../context/JobContext";
import { FaChevronDown, FaBriefcase } from "react-icons/fa";

const JobSelector = () => {
    const { jobs, selectedJob, setSelectedJob, fetchJobs, loading } = useJobContext();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const handleSelectJob = (job) => {
        setSelectedJob(job);
        setIsOpen(false);
    };

    return (
        <div className="job-selector" id="job-selector">
            <label className="job-selector-label">
                <FaBriefcase style={{ marginRight: "8px" }} />
                Select Job
            </label>
            <div className="job-selector-dropdown">
                <button
                    className="job-selector-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={loading}
                    id="job-selector-trigger"
                >
                    {loading ? (
                        <span className="selector-loading">Loading jobs...</span>
                    ) : selectedJob ? (
                        <div className="selected-job-info">
                            <span className="selected-job-title">{selectedJob.title}</span>
                            <span className="selected-job-meta">
                                {selectedJob.category} • {selectedJob.city}, {selectedJob.country}
                            </span>
                        </div>
                    ) : (
                        <span className="selector-placeholder">Choose a job to manage...</span>
                    )}
                    <FaChevronDown className={`selector-arrow ${isOpen ? "open" : ""}`} />
                </button>

                {isOpen && (
                    <div className="job-selector-menu" id="job-selector-menu">
                        {jobs.length === 0 ? (
                            <div className="selector-empty">
                                <p>No jobs posted yet</p>
                            </div>
                        ) : (
                            jobs.map((job) => (
                                <button
                                    key={job.id}
                                    className={`selector-option ${selectedJob?.id === job.id ? "selected" : ""
                                        }`}
                                    onClick={() => handleSelectJob(job)}
                                >
                                    <div className="option-info">
                                        <span className="option-title">{job.title}</span>
                                        <span className="option-meta">
                                            {job.category} • {job.city}, {job.country}
                                            {job.expired && " • Closed"}
                                        </span>
                                    </div>
                                    {selectedJob?.id === job.id && (
                                        <span className="option-check">✓</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobSelector;
