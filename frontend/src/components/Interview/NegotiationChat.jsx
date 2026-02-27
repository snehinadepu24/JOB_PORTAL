import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { formatDateTime } from "../../utils/helpers";
import { FaPaperPlane, FaRobot, FaUser, FaExclamationTriangle } from "react-icons/fa";

const ChatMessage = ({ message }) => {
    const isBot = message.sender === "bot" || message.sender === "system";

    return (
        <div className={`chat-message ${isBot ? "bot" : "user"}`}>
            <div className="chat-avatar">
                {isBot ? <FaRobot /> : <FaUser />}
            </div>
            <div className="chat-bubble">
                <p className="chat-text">{message.content || message.message}</p>
                <span className="chat-time">
                    {formatDateTime(message.timestamp || message.created_at)}
                </span>
            </div>
        </div>
    );
};

const TypingIndicator = () => (
    <div className="chat-message bot">
        <div className="chat-avatar">
            <FaRobot />
        </div>
        <div className="chat-bubble typing">
            <div className="typing-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
            </div>
            <span className="typing-text">Bot is typing...</span>
        </div>
    </div>
);

const NegotiationChat = () => {
    const { interviewId } = useParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState(null);
    const [sessionInfo, setSessionInfo] = useState({
        currentRound: 0,
        maxRounds: 3,
        escalated: false,
    });
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchHistory();
    }, [interviewId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const fetchHistory = async () => {
        try {
            const { data } = await axios.get(
                `http://localhost:4000/api/v1/interview/negotiation/${interviewId}`,
                { withCredentials: true }
            );
            if (data.data) {
                setMessages(data.data.messages || []);
                setSessionInfo({
                    currentRound: data.data.currentRound || 0,
                    maxRounds: data.data.maxRounds || 3,
                    escalated: data.data.escalated || false,
                });
            }
        } catch (err) {
            // Start with empty chat if no history
            setMessages([
                {
                    sender: "bot",
                    content:
                        "Hi! I understand none of the available slots work for you. Let me help find an alternative time. What times and dates would work best for you?",
                    timestamp: new Date().toISOString(),
                },
            ]);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || sending || sessionInfo.escalated) return;

        const userMessage = {
            sender: "user",
            content: input,
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setSending(true);
        setIsTyping(true);

        try {
            const { data } = await axios.post(
                `http://localhost:4000/api/v1/interview/negotiation/${interviewId}`,
                { message: input },
                { withCredentials: true }
            );

            setIsTyping(false);

            if (data.data) {
                const botMessage = {
                    sender: "bot",
                    content: data.data.response || data.data.message,
                    timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, botMessage]);

                setSessionInfo((prev) => ({
                    ...prev,
                    currentRound: data.data.currentRound || prev.currentRound + 1,
                    escalated: data.data.escalated || false,
                }));
            }
        } catch (err) {
            setIsTyping(false);
            setError("Failed to send message. Please try again.");
            setTimeout(() => setError(null), 3000);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="interview-page page">
            <div className="negotiation-container" id="negotiation-chat">
                <div className="negotiation-header">
                    <h2>Schedule Negotiation</h2>
                    <div className="rounds-indicator">
                        <span>
                            Round {sessionInfo.currentRound} / {sessionInfo.maxRounds}
                        </span>
                        <div className="rounds-dots">
                            {Array.from({ length: sessionInfo.maxRounds }).map((_, i) => (
                                <span
                                    key={i}
                                    className={`round-dot ${i < sessionInfo.currentRound ? "filled" : ""}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {sessionInfo.escalated && (
                    <div className="escalation-notice">
                        <FaExclamationTriangle style={{ marginRight: "8px" }} />
                        This negotiation has been escalated to the recruiter. They will reach out to you directly.
                    </div>
                )}

                <div className="chat-messages" id="chat-messages">
                    {messages.map((msg, i) => (
                        <ChatMessage key={i} message={msg} />
                    ))}
                    {isTyping && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>

                {error && (
                    <div className="interview-error" style={{ margin: "8px 0" }}>
                        {error}
                    </div>
                )}

                <div className="chat-input-area">
                    <textarea
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value.slice(0, 500))}
                        placeholder={
                            sessionInfo.escalated
                                ? "Chat disabled — escalated to recruiter"
                                : "Suggest your preferred times..."
                        }
                        disabled={sessionInfo.escalated || sending}
                        maxLength={500}
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        id="chat-input"
                    />
                    <div className="chat-input-footer">
                        <span className="char-count">{input.length}/500</span>
                        <button
                            className="send-btn"
                            onClick={handleSend}
                            disabled={!input.trim() || sending || sessionInfo.escalated}
                            id="send-message-btn"
                        >
                            <FaPaperPlane />
                            {sending ? "Sending..." : "Send"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NegotiationChat;
