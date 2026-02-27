import React, { useEffect, useState } from "react";
import { useJobContext } from "../../context/JobContext";
import { useDashboardContext } from "../../context/DashboardContext";
import { formatDateTime, ACTION_TYPE_MAP } from "../../utils/helpers";
import { FaSync, FaFilter, FaCalendarAlt, FaClipboardList } from "react-icons/fa";

const ActivityLog = () => {
    const { selectedJob } = useJobContext();
    const {
        activityLog,
        activityLogMeta,
        activityLoading,
        fetchActivityLog,
        activityFilters,
        setActivityFilters,
        autoRefresh,
        setAutoRefresh,
    } = useDashboardContext();

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        if (selectedJob) {
            fetchActivityLog(selectedJob.id);
        }
    }, [selectedJob, activityFilters, fetchActivityLog]);

    const handleFilterChange = (key, value) => {
        setActivityFilters((prev) => ({ ...prev, [key]: value, offset: 0 }));
        setCurrentPage(1);
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
        setActivityFilters((prev) => ({
            ...prev,
            offset: (page - 1) * itemsPerPage,
        }));
    };

    const totalPages = activityLogMeta
        ? Math.ceil(activityLogMeta.total / itemsPerPage)
        : 1;

    return (
        <div className="activity-log" id="activity-log">
            {/* Filters */}
            <div className="activity-filters">
                <div className="filter-group">
                    <FaFilter className="filter-icon" />
                    <select
                        value={activityFilters.action_type}
                        onChange={(e) => handleFilterChange("action_type", e.target.value)}
                        className="filter-select"
                        id="action-type-filter"
                    >
                        <option value="">All Actions</option>
                        {Object.entries(ACTION_TYPE_MAP).map(([key, info]) => (
                            <option key={key} value={key}>
                                {info.icon} {info.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <FaCalendarAlt className="filter-icon" />
                    <input
                        type="date"
                        value={activityFilters.startDate}
                        onChange={(e) => handleFilterChange("startDate", e.target.value)}
                        className="filter-input"
                        placeholder="From date"
                    />
                    <span className="filter-separator">to</span>
                    <input
                        type="date"
                        value={activityFilters.endDate}
                        onChange={(e) => handleFilterChange("endDate", e.target.value)}
                        className="filter-input"
                    />
                </div>

                <label className="auto-refresh-toggle">
                    <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        id="auto-refresh-toggle"
                    />
                    <FaSync className={`refresh-icon ${autoRefresh ? "spinning" : ""}`} />
                    <span>Auto-refresh</span>
                </label>
            </div>

            {/* Table */}
            {activityLoading ? (
                <div className="candidate-loading">
                    <div className="loading-spinner-container">
                        <div className="loading-spinner"></div>
                        <p>Loading activity log...</p>
                    </div>
                </div>
            ) : activityLog.length === 0 ? (
                <div className="candidate-empty">
                    <FaClipboardList style={{ fontSize: "48px", color: "#d1d5db", marginBottom: "16px" }} />
                    <h4>No Activity Yet</h4>
                    <p>Automation activity will appear here once triggered.</p>
                </div>
            ) : (
                <>
                    <div className="candidate-table-wrapper">
                        <table className="candidate-table activity-table" id="activity-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Action</th>
                                    <th>Candidate</th>
                                    <th>Outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activityLog.map((log) => (
                                    <LogRow key={log.id} log={log} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="page-btn"
                                disabled={currentPage === 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                            >
                                ← Prev
                            </button>
                            <div className="page-numbers">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 5 && currentPage > 3) {
                                        pageNum = currentPage - 2 + i;
                                        if (pageNum > totalPages) return null;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            className={`page-num ${currentPage === pageNum ? "active" : ""}`}
                                            onClick={() => handlePageChange(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }).filter(Boolean)}
                            </div>
                            <button
                                className="page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                            >
                                Next →
                            </button>
                            <span className="page-info">
                                {activityLogMeta?.total || 0} total entries
                            </span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// LogRow Component (Task 12.2)
const LogRow = ({ log }) => {
    const actionInfo = ACTION_TYPE_MAP[log.action_type] || {
        label: log.action_type,
        icon: "❓",
        color: "#6b7280",
    };

    return (
        <tr className="log-row">
            <td className="date-cell">{formatDateTime(log.created_at)}</td>
            <td>
                <span
                    className="action-badge"
                    style={{
                        backgroundColor: `${actionInfo.color}15`,
                        color: actionInfo.color,
                        borderColor: `${actionInfo.color}40`,
                    }}
                >
                    <span className="action-icon">{actionInfo.icon}</span>
                    {actionInfo.label}
                </span>
            </td>
            <td className="name-cell">
                {log.candidate_name || log.details?.candidate_name || "—"}
            </td>
            <td className="outcome-cell">
                {log.outcome || log.details?.outcome || "—"}
            </td>
        </tr>
    );
};

export default ActivityLog;
