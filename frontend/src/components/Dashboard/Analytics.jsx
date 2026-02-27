import React, { useEffect } from "react";
import { useJobContext } from "../../context/JobContext";
import { useDashboardContext } from "../../context/DashboardContext";
import { FaClock, FaChartLine, FaCalendarCheck, FaShieldAlt, FaDownload, FaArrowUp, FaArrowDown } from "react-icons/fa";

const MetricCard = ({ title, value, icon, color, trend, breakdown }) => (
    <div className="metric-card" style={{ borderTop: `3px solid ${color}` }}>
        <div className="metric-card-header">
            <span className="metric-icon" style={{ color }}>{icon}</span>
            <span className="metric-title">{title}</span>
        </div>
        <div className="metric-value-row">
            <span className="metric-value">{value}</span>
            {trend && (
                <span className={`metric-trend ${trend.direction}`}>
                    {trend.direction === "up" ? <FaArrowUp /> : <FaArrowDown />}
                    {trend.percentage}%
                </span>
            )}
        </div>
        {breakdown && (
            <div className="metric-breakdown">
                {breakdown.map((item, i) => (
                    <div key={i} className="breakdown-item">
                        <span className="breakdown-label">{item.label}</span>
                        <span className="breakdown-value">{item.value}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const Analytics = () => {
    const { selectedJob } = useJobContext();
    const { analytics, analyticsLoading, fetchAnalytics } = useDashboardContext();

    useEffect(() => {
        if (selectedJob) {
            fetchAnalytics(selectedJob.id);
        }
    }, [selectedJob, fetchAnalytics]);

    const handleExport = () => {
        if (!analytics) return;

        const csvRows = [
            ["Metric", "Value"],
            ["Time Saved (hours)", analytics.time_saved_hours || 0],
            ["Success Rate (%)", analytics.success_rate || 0],
            ["Avg Time to Interview (hours)", analytics.avg_time_to_interview || 0],
            ["Response Rate (%)", analytics.response_rate || 0],
            ["No-Show Rate (%)", analytics.no_show_rate || 0],
            ["Avg Negotiation Rounds", analytics.avg_negotiation_rounds || 0],
            ["Total Applications", analytics.total_applications || 0],
            ["Total Interviews", analytics.total_interviews || 0],
        ];

        const csvContent = csvRows.map((row) => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${selectedJob.title.replace(/\s+/g, "-")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (analyticsLoading) {
        return (
            <div className="candidate-loading">
                <div className="loading-spinner-container">
                    <div className="loading-spinner"></div>
                    <p>Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="candidate-empty">
                <FaChartLine style={{ fontSize: "48px", color: "#d1d5db", marginBottom: "16px" }} />
                <h4>No Analytics Data</h4>
                <p>Analytics will be available once automation is triggered.</p>
            </div>
        );
    }

    return (
        <div className="analytics-panel" id="analytics-panel">
            <div className="analytics-header">
                <h3 className="analytics-title">📊 Hiring Analytics</h3>
                <button
                    className="export-btn"
                    onClick={handleExport}
                    id="export-csv-btn"
                >
                    <FaDownload style={{ marginRight: "8px" }} />
                    Export Data (CSV)
                </button>
            </div>

            <div className="metrics-grid">
                <MetricCard
                    title="Time Saved"
                    value={`${analytics.time_saved_hours || 0}h`}
                    icon={<FaClock />}
                    color="#8b5cf6"
                    breakdown={
                        analytics.time_saved_breakdown
                            ? [
                                { label: "Screening", value: `${analytics.time_saved_breakdown.screening || 0}h` },
                                { label: "Scheduling", value: `${analytics.time_saved_breakdown.scheduling || 0}h` },
                                { label: "Communication", value: `${analytics.time_saved_breakdown.communication || 0}h` },
                            ]
                            : undefined
                    }
                />

                <MetricCard
                    title="Success Rate"
                    value={`${analytics.success_rate || 0}%`}
                    icon={<FaChartLine />}
                    color="#22c55e"
                    trend={
                        analytics.success_rate_trend
                            ? {
                                direction: analytics.success_rate_trend > 0 ? "up" : "down",
                                percentage: Math.abs(analytics.success_rate_trend),
                            }
                            : undefined
                    }
                />

                <MetricCard
                    title="Avg Time to Interview"
                    value={`${analytics.avg_time_to_interview || 0}h`}
                    icon={<FaCalendarCheck />}
                    color="#3b82f6"
                />

                <MetricCard
                    title="Buffer Health"
                    value={`${analytics.buffer_health_percentage || 0}%`}
                    icon={<FaShieldAlt />}
                    color="#f59e0b"
                />
            </div>

            {/* Conversion Funnel */}
            {analytics.funnel && (
                <div className="conversion-funnel">
                    <h4>Conversion Funnel</h4>
                    <div className="funnel-steps">
                        {[
                            { label: "Applications", value: analytics.funnel.applications || 0 },
                            { label: "Shortlisted", value: analytics.funnel.shortlisted || 0 },
                            { label: "Invited", value: analytics.funnel.invited || 0 },
                            { label: "Accepted", value: analytics.funnel.accepted || 0 },
                            { label: "Confirmed", value: analytics.funnel.confirmed || 0 },
                        ].map((step, index) => (
                            <div key={index} className="funnel-step">
                                <div
                                    className="funnel-bar"
                                    style={{
                                        width: `${analytics.funnel.applications > 0
                                                ? Math.max(10, (step.value / analytics.funnel.applications) * 100)
                                                : 10
                                            }%`,
                                    }}
                                />
                                <div className="funnel-info">
                                    <span className="funnel-label">{step.label}</span>
                                    <span className="funnel-value">{step.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Additional Metrics */}
            <div className="additional-metrics">
                <h4>Additional Metrics</h4>
                <div className="additional-grid">
                    <div className="additional-item">
                        <span className="additional-label">Response Rate</span>
                        <span className="additional-value">
                            {analytics.response_rate || 0}%
                        </span>
                    </div>
                    <div className="additional-item">
                        <span className="additional-label">No-Show Rate</span>
                        <span className="additional-value">
                            {analytics.no_show_rate || 0}%
                        </span>
                    </div>
                    <div className="additional-item">
                        <span className="additional-label">Avg Negotiation Rounds</span>
                        <span className="additional-value">
                            {analytics.avg_negotiation_rounds || 0}
                        </span>
                    </div>
                    <div className="additional-item">
                        <span className="additional-label">Total Applications</span>
                        <span className="additional-value">
                            {analytics.total_applications || 0}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
