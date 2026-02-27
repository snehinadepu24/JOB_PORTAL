import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { FaCheckCircle, FaBriefcase, FaExclamationTriangle } from "react-icons/fa";

const InterviewAccept = () => {
    const { interviewId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [error, setError] = useState(null);
    const token = new URLSearchParams(window.location.search).get("token");

    const handleAccept = async () => {
        setLoading(true);
        setError(null);
        try {
            await axios.post(
                `http://localhost:4000/api/v1/interview/confirm-slot/${interviewId}`,
                { token },
                { withCredentials: true }
            );
            setAccepted(true);
            setTimeout(() => {
                navigate(`/interview/select-slot/${interviewId}`);
            }, 2000);
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to accept interview invitation"
            );
        } finally {
            setLoading(false);
        }
    };

    if (accepted) {
        return (
            <div className="interview-page page">
                <div className="interview-card success">
                    <FaCheckCircle className="interview-icon success-icon" />
                    <h2>Interview Accepted!</h2>
                    <p>Redirecting you to select your preferred time slot...</p>
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="interview-page page">
            <div className="interview-card">
                <FaBriefcase className="interview-icon" />
                <h2>Interview Invitation</h2>
                <p className="interview-description">
                    You have been invited for an interview. Click below to confirm your
                    acceptance and proceed to select a time slot.
                </p>

                {error && (
                    <div className="interview-error">
                        <FaExclamationTriangle style={{ marginRight: "8px" }} />
                        {error}
                    </div>
                )}

                <button
                    className="interview-action-btn accept"
                    onClick={handleAccept}
                    disabled={loading}
                    id="confirm-acceptance-btn"
                >
                    {loading ? "Accepting..." : "Confirm Acceptance"}
                </button>

                <p className="interview-note">
                    By accepting, you agree to proceed with the interview scheduling process.
                </p>
            </div>
        </div>
    );
};

export default InterviewAccept;
