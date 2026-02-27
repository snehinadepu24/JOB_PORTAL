/**
 * Shared utility functions for the Job Portal frontend
 */

// ============================================
// Date Formatting Utilities
// ============================================

export const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

export const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const formatTimeAgo = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
};

// ============================================
// Buffer Calculation (Task 4.1)
// ============================================

/**
 * Calculate shortlisting buffer based on number of openings
 * H×2 for H>5, H×3 for 2-5, 4 for H=1
 */
export const calculateBuffer = (numberOfOpenings) => {
    const h = parseInt(numberOfOpenings) || 0;
    if (h <= 0) return 0;
    if (h === 1) return 4;
    if (h >= 2 && h <= 5) return h * 3;
    return h * 2; // h > 5
};

// ============================================
// Status Mapping
// ============================================

export const APPLICATION_STATUS_MAP = {
    pending: { label: "Pending", color: "#f59e0b", bg: "#fef3c7" },
    accepted: { label: "Accepted", color: "#22c55e", bg: "#dcfce7" },
    rejected: { label: "Rejected", color: "#ef4444", bg: "#fee2e2" },
};

export const SHORTLIST_STATUS_MAP = {
    shortlisted: { label: "Shortlisted", color: "#22c55e", bg: "#dcfce7" },
    buffer: { label: "Buffer", color: "#3b82f6", bg: "#dbeafe" },
    pending: { label: "Pending", color: "#f59e0b", bg: "#fef3c7" },
    rejected: { label: "Rejected", color: "#ef4444", bg: "#fee2e2" },
};

export const INTERVIEW_STATUS_MAP = {
    invitation_sent: { label: "Invited", color: "#3b82f6", bg: "#dbeafe" },
    invitation_expired: { label: "Expired", color: "#6b7280", bg: "#f3f4f6" },
    accepted: { label: "Accepted", color: "#22c55e", bg: "#dcfce7" },
    rejected: { label: "Rejected", color: "#ef4444", bg: "#fee2e2" },
    slot_pending: { label: "Slot Pending", color: "#f59e0b", bg: "#fef3c7" },
    confirmed: { label: "Confirmed", color: "#059669", bg: "#d1fae5" },
    slot_selected: { label: "Slot Selected", color: "#8b5cf6", bg: "#ede9fe" },
    negotiation: { label: "Negotiating", color: "#f97316", bg: "#fff7ed" },
    escalated: { label: "Escalated", color: "#dc2626", bg: "#fef2f2" },
};

export const BUFFER_HEALTH_MAP = {
    full: { label: "Full", color: "#059669", bg: "#d1fae5" },
    healthy: { label: "Healthy", color: "#22c55e", bg: "#dcfce7" },
    low: { label: "Low", color: "#f59e0b", bg: "#fef3c7" },
    critical: { label: "Critical", color: "#ef4444", bg: "#fee2e2" },
    empty: { label: "Empty", color: "#6b7280", bg: "#f3f4f6" },
};

// ============================================
// Activity Log Action Types
// ============================================

export const ACTION_TYPE_MAP = {
    invitation_sent: { label: "Invitation Sent", icon: "📧", color: "#3b82f6" },
    invitation_expired: { label: "Invitation Expired", icon: "⏰", color: "#6b7280" },
    slot_selected: { label: "Slot Selected", icon: "📅", color: "#8b5cf6" },
    slot_confirmed: { label: "Slot Confirmed", icon: "✅", color: "#22c55e" },
    interview_cancelled: { label: "Interview Cancelled", icon: "❌", color: "#ef4444" },
    negotiation_started: { label: "Negotiation Started", icon: "💬", color: "#f97316" },
    negotiation_escalated: { label: "Escalated", icon: "⚠️", color: "#dc2626" },
    buffer_promotion: { label: "Buffer Promoted", icon: "⬆️", color: "#059669" },
    auto_shortlist: { label: "Auto Shortlisted", icon: "🤖", color: "#2563eb" },
    background_cycle: { label: "Background Cycle", icon: "🔄", color: "#9ca3af" },
    risk_analysis_failed: { label: "Risk Analysis Failed", icon: "⚡", color: "#f59e0b" },
    calendar_creation_failed: { label: "Calendar Failed", icon: "📅", color: "#ef4444" },
    confirmation_email_failed: { label: "Email Failed", icon: "📧", color: "#ef4444" },
};

// ============================================
// Buffer Health Calculator
// ============================================

export const getBufferHealth = (bufferCount, targetBuffer) => {
    if (targetBuffer <= 0) return "empty";
    const ratio = bufferCount / targetBuffer;
    if (ratio >= 1) return "full";
    if (ratio >= 0.7) return "healthy";
    if (ratio >= 0.3) return "low";
    if (ratio > 0) return "critical";
    return "empty";
};

// ============================================
// Countdown Timer
// ============================================

export const getTimeRemaining = (deadline) => {
    if (!deadline) return null;
    const total = new Date(deadline) - new Date();
    if (total <= 0) return { expired: true, display: "Expired" };

    const hours = Math.floor(total / 3600000);
    const minutes = Math.floor((total % 3600000) / 60000);

    return {
        expired: false,
        total,
        hours,
        minutes,
        display: `${hours}h ${minutes}m`,
    };
};
