import React, { useEffect, useState } from "react";
import { useJobContext } from "../../context/JobContext";
import { useDashboardContext } from "../../context/DashboardContext";
import {
    SHORTLIST_STATUS_MAP,
    INTERVIEW_STATUS_MAP,
    formatDate,
} from "../../utils/helpers";
import CandidateDetailModal from "./CandidateDetailModal";
import { FaSort, FaSortUp, FaSortDown, FaFilter, FaTimes, FaSearch } from "react-icons/fa";

const CandidateList = () => {
    const { selectedJob } = useJobContext();
    const {
        candidates,
        candidatesLoading,
        fetchCandidates,
        candidateFilters,
        setCandidateFilters,
    } = useDashboardContext();

    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        if (selectedJob) {
            fetchCandidates(selectedJob.id);
        }
    }, [selectedJob, candidateFilters, fetchCandidates]);

    const handleFilterChange = (key, value) => {
        setCandidateFilters((prev) => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleSort = (field) => {
        setCandidateFilters((prev) => ({
            ...prev,
            sortBy: field,
            sortOrder:
                prev.sortBy === field && prev.sortOrder === "desc" ? "asc" : "desc",
        }));
    };

    const clearFilters = () => {
        setCandidateFilters({
            sortBy: "fit_score",
            sortOrder: "desc",
            filterStatus: "",
        });
        setCurrentPage(1);
    };

    // Pagination
    const totalPages = Math.ceil(candidates.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedCandidates = candidates.slice(
        startIdx,
        startIdx + itemsPerPage
    );

    const getSortIcon = (field) => {
        if (candidateFilters.sortBy !== field) return <FaSort />;
        return candidateFilters.sortOrder === "asc" ? <FaSortUp /> : <FaSortDown />;
    };

    return (
        <div className="candidate-list" id="candidate-list">
            {/* Filters */}
            <div className="candidate-filters">
                <div className="filter-group">
                    <FaFilter className="filter-icon" />
                    <select
                        value={candidateFilters.filterStatus}
                        onChange={(e) => handleFilterChange("filterStatus", e.target.value)}
                        className="filter-select"
                        id="status-filter"
                    >
                        <option value="">All Statuses</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="buffer">Buffer</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>

                <div className="filter-group">
                    <FaSort className="filter-icon" />
                    <select
                        value={candidateFilters.sortBy}
                        onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                        className="filter-select"
                        id="sort-select"
                    >
                        <option value="fit_score">Fit Score</option>
                        <option value="rank">Rank</option>
                        <option value="name">Name</option>
                        <option value="created_at">Date Applied</option>
                    </select>
                </div>

                {(candidateFilters.filterStatus || candidateFilters.sortBy !== "fit_score") && (
                    <button className="clear-filters-btn" onClick={clearFilters}>
                        <FaTimes style={{ marginRight: "4px" }} /> Clear
                    </button>
                )}

                <span className="candidate-count">
                    {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Loading */}
            {candidatesLoading ? (
                <div className="candidate-loading">
                    <div className="loading-spinner-container">
                        <div className="loading-spinner"></div>
                        <p>Loading candidates...</p>
                    </div>
                </div>
            ) : candidates.length === 0 ? (
                <div className="candidate-empty">
                    <FaSearch style={{ fontSize: "48px", color: "#d1d5db", marginBottom: "16px" }} />
                    <h4>No Candidates Found</h4>
                    <p>
                        {candidateFilters.filterStatus
                            ? "Try changing your filters"
                            : "No applications yet for this job"}
                    </p>
                </div>
            ) : (
                <>
                    {/* Table */}
                    <div className="candidate-table-wrapper">
                        <table className="candidate-table" id="candidate-table">
                            <thead>
                                <tr>
                                    <th
                                        className="sortable"
                                        onClick={() => handleSort("rank")}
                                    >
                                        Rank {getSortIcon("rank")}
                                    </th>
                                    <th
                                        className="sortable"
                                        onClick={() => handleSort("name")}
                                    >
                                        Name {getSortIcon("name")}
                                    </th>
                                    <th
                                        className="sortable"
                                        onClick={() => handleSort("fit_score")}
                                    >
                                        Fit Score {getSortIcon("fit_score")}
                                    </th>
                                    <th>Status</th>
                                    <th>Interview</th>
                                    <th>Applied</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCandidates.map((candidate, index) => (
                                    <CandidateRow
                                        key={candidate.id}
                                        candidate={candidate}
                                        rank={startIdx + index + 1}
                                        onClick={() => setSelectedCandidate(candidate)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination" id="pagination">
                            <button
                                className="page-btn"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => p - 1)}
                            >
                                ← Prev
                            </button>
                            <div className="page-numbers">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            className={`page-num ${currentPage === pageNum ? "active" : ""}`}
                                            onClick={() => setCurrentPage(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                className="page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                            >
                                Next →
                            </button>
                            <span className="page-info">
                                {startIdx + 1}-{Math.min(startIdx + itemsPerPage, candidates.length)} of{" "}
                                {candidates.length}
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* Detail Modal */}
            {selectedCandidate && (
                <CandidateDetailModal
                    candidate={selectedCandidate}
                    onClose={() => setSelectedCandidate(null)}
                />
            )}
        </div>
    );
};

// CandidateRow Component (Task 7.2)
const CandidateRow = ({ candidate, rank, onClick }) => {
    const statusInfo = SHORTLIST_STATUS_MAP[candidate.shortlist_status] || {};
    const interviewInfo = INTERVIEW_STATUS_MAP[candidate.interview_status] || {};

    return (
        <tr className="candidate-row" onClick={onClick}>
            <td className="rank-cell">
                <span className="rank-badge">#{rank}</span>
            </td>
            <td className="name-cell">
                <div className="candidate-name-group">
                    <span className="candidate-name">{candidate.name}</span>
                    <span className="candidate-email">{candidate.email}</span>
                </div>
            </td>
            <td className="score-cell">
                <div className="score-bar-container">
                    <div
                        className="score-bar"
                        style={{
                            width: `${Math.min(100, (candidate.fit_score || 0) * 10)}%`,
                            backgroundColor:
                                candidate.fit_score >= 8
                                    ? "#22c55e"
                                    : candidate.fit_score >= 5
                                        ? "#f59e0b"
                                        : "#ef4444",
                        }}
                    />
                    <span className="score-value">{candidate.fit_score?.toFixed(1) || "N/A"}</span>
                </div>
            </td>
            <td>
                <span
                    className="status-badge-inline"
                    style={{
                        backgroundColor: statusInfo.bg || "#f3f4f6",
                        color: statusInfo.color || "#6b7280",
                    }}
                >
                    {statusInfo.label || candidate.shortlist_status || "—"}
                </span>
            </td>
            <td>
                {candidate.interview_status ? (
                    <span
                        className="status-badge-inline"
                        style={{
                            backgroundColor: interviewInfo.bg || "#f3f4f6",
                            color: interviewInfo.color || "#6b7280",
                        }}
                    >
                        {interviewInfo.label || candidate.interview_status}
                    </span>
                ) : (
                    <span className="no-interview">—</span>
                )}
            </td>
            <td className="date-cell">{formatDate(candidate.created_at)}</td>
        </tr>
    );
};

export default CandidateList;
