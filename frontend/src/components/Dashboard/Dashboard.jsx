import React, { useContext, useEffect, useState } from "react";
import { Context } from "../../main";
import { useNavigate } from "react-router-dom";
import { useJobContext } from "../../context/JobContext";
import { useDashboardContext } from "../../context/DashboardContext";
import JobSelector from "./JobSelector";
import ShortlistSummary from "./ShortlistSummary";
import CandidateList from "./CandidateList";
import ActivityLog from "./ActivityLog";
import Analytics from "./Analytics";
import { FaUsers, FaClipboardList, FaChartBar } from "react-icons/fa";

const Dashboard = () => {
    const { isAuthorized, user } = useContext(Context);
    const { selectedJob } = useJobContext();
    const { setCurrentJobId } = useDashboardContext();
    const [activeTab, setActiveTab] = useState("candidates");
    const navigateTo = useNavigate();

    useEffect(() => {
        if (!isAuthorized || (user && user.role !== "Employer")) {
            navigateTo("/");
        }
    }, [isAuthorized, user, navigateTo]);

    useEffect(() => {
        if (selectedJob) {
            setCurrentJobId(selectedJob.id);
        }
    }, [selectedJob, setCurrentJobId]);

    const tabs = [
        { key: "candidates", label: "Candidates", icon: <FaUsers /> },
        { key: "activity", label: "Activity Log", icon: <FaClipboardList /> },
        { key: "analytics", label: "Analytics", icon: <FaChartBar /> },
    ];

    return (
        <div className="dashboard page">
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h2 className="dashboard-title">Hiring Dashboard</h2>
                    <p className="dashboard-subtitle">
                        Monitor your hiring pipeline and AI automation
                    </p>
                </div>

                <JobSelector />

                {selectedJob ? (
                    <>
                        <ShortlistSummary />

                        <div className="dashboard-tabs">
                            <div className="tab-nav" role="tablist">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        role="tab"
                                        id={`tab-${tab.key}`}
                                        className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                                        onClick={() => setActiveTab(tab.key)}
                                        aria-selected={activeTab === tab.key}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="tab-content" role="tabpanel">
                                {activeTab === "candidates" && <CandidateList />}
                                {activeTab === "activity" && <ActivityLog />}
                                {activeTab === "analytics" && <Analytics />}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="dashboard-empty">
                        <div className="empty-icon">📊</div>
                        <h3>Select a Job to Get Started</h3>
                        <p>Choose a job from the dropdown above to view candidates, activity logs, and analytics.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
