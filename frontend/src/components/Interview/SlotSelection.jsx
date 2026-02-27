import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { interviewService } from "../../services/api";
import { getTimeRemaining } from "../../utils/helpers";
import toast from "react-hot-toast";
import { FaClock, FaCheck, FaCalendarAlt, FaExclamationTriangle } from "react-icons/fa";

const SlotCard = ({ slot, selected, onSelect }) => (
    <div
        className={`slot-card ${selected ? "selected" : ""}`}
        onClick={onSelect}
        role="radio"
        aria-checked={selected}
    >
        <div className="slot-card-content">
            <FaCalendarAlt className="slot-icon" />
            <div className="slot-details">
                <span className="slot-date">
                    {new Date(slot.start).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                    })}
                </span>
                <span className="slot-time">
                    {new Date(slot.start).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(slot.end).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </span>
                {slot.display && (
                    <span className="slot-display">{slot.display}</span>
                )}
            </div>
        </div>
        {selected && (
            <div className="slot-check">
                <FaCheck />
            </div>
        )}
    </div>
);

const CountdownTimer = ({ deadline }) => {
    const [remaining, setRemaining] = useState(getTimeRemaining(deadline));

    useEffect(() => {
        const interval = setInterval(() => {
            setRemaining(getTimeRemaining(deadline));
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [deadline]);

    if (!remaining) return null;

    return (
        <div className={`countdown-timer ${remaining.expired ? "expired" : ""}`}>
            <FaClock style={{ marginRight: "8px" }} />
            {remaining.expired ? (
                <span>⏰ Deadline has passed</span>
            ) : (
                <span>
                    Time remaining: <strong>{remaining.display}</strong>
                </span>
            )}
        </div>
    );
};

const SlotSelection = () => {
    const { interviewId } = useParams();
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [deadline, setDeadline] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState(null);

    const fetchSlots = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await interviewService.getSlots(interviewId);
            setSlots(data.data?.slots || []);
            setDeadline(data.data?.deadline);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load available slots");
        } finally {
            setLoading(false);
        }
    }, [interviewId]);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

    const handleConfirm = async () => {
        if (!selectedSlot) {
            toast.error("Please select a time slot");
            return;
        }

        setConfirming(true);
        try {
            // First select the slot
            await interviewService.selectSlot(interviewId, selectedSlot);
            // Then confirm
            await interviewService.confirmSlot(interviewId);
            setConfirmed(true);
            toast.success("Interview slot confirmed!");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to confirm slot");
        } finally {
            setConfirming(false);
        }
    };

    if (confirmed) {
        return (
            <div className="interview-page page">
                <div className="interview-card success">
                    <FaCheck className="interview-icon success-icon" />
                    <h2>Interview Confirmed!</h2>
                    <p>
                        Your interview has been scheduled. A confirmation email with
                        calendar invite details has been sent to your email address.
                    </p>
                    <div className="confirmed-slot">
                        <FaCalendarAlt style={{ marginRight: "8px" }} />
                        <span>
                            {new Date(selectedSlot.start).toLocaleString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="interview-page page">
            <div className="slot-selection-container">
                <h2 className="slot-title">Select Your Interview Slot</h2>
                <p className="slot-subtitle">
                    Choose your preferred time from the available slots below
                </p>

                {deadline && <CountdownTimer deadline={deadline} />}

                {loading ? (
                    <div className="candidate-loading">
                        <div className="loading-spinner-container">
                            <div className="loading-spinner"></div>
                            <p>Loading available slots...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="interview-error">
                        <FaExclamationTriangle style={{ marginRight: "8px" }} />
                        {error}
                    </div>
                ) : slots.length === 0 ? (
                    <div className="candidate-empty">
                        <FaCalendarAlt style={{ fontSize: "48px", color: "#d1d5db", marginBottom: "16px" }} />
                        <h4>No Slots Available</h4>
                        <p>There are currently no available interview slots. Please contact the recruiter.</p>
                    </div>
                ) : (
                    <>
                        <div className="slots-grid" id="slots-grid">
                            {slots.map((slot, index) => (
                                <SlotCard
                                    key={index}
                                    slot={slot}
                                    selected={selectedSlot === slot}
                                    onSelect={() => setSelectedSlot(slot)}
                                />
                            ))}
                        </div>

                        <div className="slot-actions">
                            <button
                                className="interview-action-btn accept"
                                onClick={handleConfirm}
                                disabled={!selectedSlot || confirming}
                                id="confirm-slot-btn"
                            >
                                {confirming ? "Confirming..." : "Confirm This Slot"}
                            </button>

                            <button
                                className="interview-action-btn negotiate"
                                onClick={() =>
                                    window.location.href = `/interview/negotiate/${interviewId}`
                                }
                                id="negotiate-btn"
                            >
                                None of these work for me
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SlotSelection;
