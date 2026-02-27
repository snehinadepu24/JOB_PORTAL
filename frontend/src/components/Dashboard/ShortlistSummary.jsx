import React, { useEffect, useState } from "react";
import { useJobContext } from "../../context/JobContext";
import { useDashboardContext } from "../../context/DashboardContext";
import { getBufferHealth, BUFFER_HEALTH_MAP } from "../../utils/helpers";
import { FaTimes, FaPlay, FaUsers, FaUserShield, FaHourglass, FaCheckCircle } from "react-icons/fa";

const StatCard = ({ label, value, icon, color }) => (
    <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="stat-card-icon" style={{ color }}>{icon}</div>
        <div className="stat-card-content">
            <span className="stat-card-value">{value}</span>
            <span className="stat-card-label">{label}</span>
        </div>
    </div>
);

const BufferHealthIndicator = ({ bufferCount, targetBuffer }) => {
    const health = getBufferHealth(bufferCount, targetBuffer);
    const healthInfo = BUFFER_HEALTH_MAP[health];
    const percentage = targetBuffer > 0 ? Math.min(100, (bufferCount / targetBuffer) * 100) : 0;

    return (
        <div className="buffer-health">
            <div className="buffer-health-header">
                <span className="buffer-health-label">Buffer Health</span>
                <span
                    className="buffer-health-badge"
                    style={{ backgroundColor: healthInfo.bg, color: healthInfo.color }}
                >
                    {healthInfo.label}
                </span>
            </div>
            <div className="buffer-health-bar-bg">
                <div
                    className="buffer-health-bar-fill"
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: healthInfo.color,
                    }}
                />
            </div>
            <span className="buffer-health-percent">{Math.round(percentage)}% filled</span>
        </div>
    );
};

const ShortlistSummary = () => {
    const { selectedJob, closeApplications } = useJobContext();
    const { candidatesMeta, fetchCandidates } = useDashboardContext();
    const [closingApps, setClosingApps] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);

    useEffect(() => {
        if (selectedJob) {
            fetchCandidates(selectedJob.id);
        }
    }, [selectedJob, fetchCandidates]);

    const handleCloseApplications = async () => {
        setClosingApps(true);
        const success = await closeApplications(selectedJob.id);
        if (success) {
            setActionMessage({ type: "success", text: "Applications closed successfully!" });
        } else {
            setActionMessage({ type: "error", text: "Failed to close applications" });
        }
        setClosingApps(false);
        setShowConfirm(false);
        setTimeout(() => setActionMessage(null), 4000);
    };

    const counts = candidatesMeta?.counts || {
        total: 0,
        shortlisted: 0,
        buffer: 0,
        pending: 0,
        rejected: 0,
    };

    const targetBuffer = candidatesMeta?.job?.shortlisting_buffer || 0;

    return (
        <div className="shortlist-summary" id="shortlist-summary">
            <div className="shortlist-stats-row">
                <StatCard
                    label="Shortlisted"
                    value={counts.shortlisted}
                    icon={<FaCheckCircle />}
                    color="#22c55e"
                />
                <StatCard
                    label="Buffer"
                    value={counts.buffer}
                    icon={<FaUserShield />}
                    color="#3b82f6"
                />
                <StatCard
                    label="Pending"
                    value={counts.pending}
                    icon={<FaHourglass />}
                    color="#f59e0b"
                />
                <StatCard
                    label="Total"
                    value={counts.total}
                    icon={<FaUsers />}
                    color="#6b7280"
                />
            </div>

            <BufferHealthIndicator
                bufferCount={counts.buffer}
                targetBuffer={targetBuffer}
            />

            <div className="shortlist-actions">
                {selectedJob && !selectedJob.expired && (
                    <button
                        className="action-btn close-apps-btn"
                        onClick={() => setShowConfirm(true)}
                        disabled={closingApps}
                        id="close-applications-btn"
                    >
                        <FaTimes style={{ marginRight: "6px" }} />
                        {closingApps ? "Closing..." : "Close Applications"}
                    </button>
                )}

                {selectedJob?.expired && (
                    <span className="status-badge closed">Applications Closed</span>
                )}
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
                <div className="confirm-overlay">
                    <div className="confirm-dialog">
                        <h4>Close Applications?</h4>
                        <p>
                            This will prevent new applicants from applying to this job.
                            This action cannot be undone.
                        </p>
                        <div className="confirm-actions">
                            <button
                                className="confirm-btn danger"
                                onClick={handleCloseApplications}
                                disabled={closingApps}
                            >
                                {closingApps ? "Closing..." : "Yes, Close"}
                            </button>
                            <button
                                className="confirm-btn cancel"
                                onClick={() => setShowConfirm(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success/Error Message */}
            {actionMessage && (
                <div className={`action-message ${actionMessage.type}`}>
                    {actionMessage.text}
                </div>
            )}
        </div>
    );
};

export default ShortlistSummary;
