import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FaTimesCircle, FaHandPaper, FaExclamationTriangle } from "react-icons/fa";

const InterviewReject = () => {
    const { interviewId } = useParams();
    const [loading, setLoading] = useState(false);
    const [rejected, setRejected] = useState(false);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState("");
    const token = new URLSearchParams(window.location.search).get("token");

    const handleReject = async () => {
        setLoading(true);
        setError(null);
        try {
            await axios.post(
                `http://localhost:4000/api/v1/interview/confirm-slot/${interviewId}`,
                { token, action: "reject", feedback },
                { withCredentials: true }
            );
            setRejected(true);
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to reject interview"
            );
        } finally {
            setLoading(false);
        }
    };

    if (rejected) {
        return (
            <div className="interview-page page">
                <div className="interview-card success">
                    <FaHandPaper className="interview-icon" style={{ color: "#6b7280" }} />
                    <h2>Thank You</h2>
                    <p>
                        We've received your response. We appreciate you taking the time to
                        let us know. We wish you the best in your career journey!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="interview-page page">
            <div className="interview-card">
                <FaTimesCircle className="interview-icon reject-icon" />
                <h2>Decline Interview</h2>
                <p className="interview-description">
                    Are you sure you want to decline this interview invitation? This
                    action cannot be undone.
                </p>

                <div className="feedback-section">
                    <label className="feedback-label">
                        Feedback (optional, max 500 characters)
                    </label>
                    <textarea
                        className="feedback-textarea"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
                        placeholder="Let us know why you're declining (optional)..."
                        rows={4}
                        maxLength={500}
                        id="rejection-feedback"
                    />
                    <span className="char-count">{feedback.length}/500</span>
                </div>

                {error && (
                    <div className="interview-error">
                        <FaExclamationTriangle style={{ marginRight: "8px" }} />
                        {error}
                    </div>
                )}

                <button
                    className="interview-action-btn reject"
                    onClick={handleReject}
                    disabled={loading}
                    id="confirm-rejection-btn"
                >
                    {loading ? "Processing..." : "Confirm Rejection"}
                </button>

                <p className="interview-note">
                    This will remove your candidacy for this position.
                </p>
            </div>
        </div>
    );
};

export default InterviewReject;
