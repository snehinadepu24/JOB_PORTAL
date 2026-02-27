import React from "react";
import {
    SHORTLIST_STATUS_MAP,
    INTERVIEW_STATUS_MAP,
    formatDate,
} from "../../utils/helpers";
import { FaTimes, FaFilePdf, FaUser, FaStar, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

const CandidateDetailModal = ({ candidate, onClose }) => {
    if (!candidate) return null;

    const statusInfo = SHORTLIST_STATUS_MAP[candidate.shortlist_status] || {};
    const interviewInfo = INTERVIEW_STATUS_MAP[candidate.interview_status] || {};

    return (
        <div className="candidate-modal-overlay" onClick={onClose}>
            <div className="candidate-modal" onClick={(e) => e.stopPropagation()} id="candidate-detail-modal">
                <button className="modal-close" onClick={onClose}>
                    <FaTimes />
                </button>

                {/* Header */}
                <div className="modal-header">
                    <div className="modal-avatar">
                        <FaUser />
                    </div>
                    <div className="modal-header-info">
                        <h3>{candidate.name}</h3>
                        <p className="modal-email">{candidate.email}</p>
                        <div className="modal-badges">
                            <span
                                className="status-badge-inline"
                                style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                            >
                                {statusInfo.label || candidate.shortlist_status}
                            </span>
                            {candidate.interview_status && (
                                <span
                                    className="status-badge-inline"
                                    style={{ backgroundColor: interviewInfo.bg, color: interviewInfo.color }}
                                >
                                    {interviewInfo.label}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="modal-stats">
                    <div className="modal-stat">
                        <FaStar className="modal-stat-icon" style={{ color: "#f59e0b" }} />
                        <div>
                            <span className="modal-stat-value">
                                {candidate.fit_score?.toFixed(1) || "N/A"}
                            </span>
                            <span className="modal-stat-label">Fit Score</span>
                        </div>
                    </div>
                    <div className="modal-stat">
                        <span className="modal-stat-rank">#{candidate.rank || "—"}</span>
                        <div>
                            <span className="modal-stat-value">Rank</span>
                            <span className="modal-stat-label">Overall</span>
                        </div>
                    </div>
                    <div className="modal-stat">
                        <span className="modal-stat-icon">📅</span>
                        <div>
                            <span className="modal-stat-value">{formatDate(candidate.created_at)}</span>
                            <span className="modal-stat-label">Applied</span>
                        </div>
                    </div>
                </div>

                {/* AI Summary */}
                {candidate.ai_summary && (
                    <div className="modal-section">
                        <h4>🤖 AI Summary</h4>
                        <p className="ai-summary-text">{candidate.ai_summary}</p>
                    </div>
                )}

                {/* Skills */}
                {(candidate.matched_skills || candidate.missing_skills) && (
                    <div className="modal-section">
                        <h4>Skills Analysis</h4>
                        {candidate.matched_skills && candidate.matched_skills.length > 0 && (
                            <div className="skills-group">
                                <span className="skills-label">
                                    <FaCheckCircle style={{ color: "#22c55e" }} /> Matched Skills
                                </span>
                                <div className="skills-tags">
                                    {candidate.matched_skills.map((skill, i) => (
                                        <span key={i} className="skill-tag matched">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {candidate.missing_skills && candidate.missing_skills.length > 0 && (
                            <div className="skills-group">
                                <span className="skills-label">
                                    <FaTimesCircle style={{ color: "#ef4444" }} /> Missing Skills
                                </span>
                                <div className="skills-tags">
                                    {candidate.missing_skills.map((skill, i) => (
                                        <span key={i} className="skill-tag missing">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Cover Letter */}
                {candidate.cover_letter && (
                    <div className="modal-section">
                        <h4>Cover Letter</h4>
                        <p className="cover-letter-text">{candidate.cover_letter}</p>
                    </div>
                )}

                {/* Contact & Resume */}
                <div className="modal-section">
                    <h4>Contact Information</h4>
                    <div className="contact-grid">
                        <div className="contact-item">
                            <span className="contact-label">Phone</span>
                            <span className="contact-value">{candidate.phone || "N/A"}</span>
                        </div>
                        <div className="contact-item">
                            <span className="contact-label">Address</span>
                            <span className="contact-value">{candidate.address || "N/A"}</span>
                        </div>
                    </div>
                </div>

                {/* Resume Link */}
                {candidate.resume_url && (
                    <a
                        href={candidate.resume_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-resume-btn"
                        id="view-resume-btn"
                    >
                        <FaFilePdf style={{ marginRight: "8px" }} />
                        View Resume
                    </a>
                )}
            </div>
        </div>
    );
};

export default CandidateDetailModal;
