import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { supabase } from "../database/supabaseClient.js";

/**
 * Get ranked candidates for a job
 * Requirements: 9.1, 9.2, 9.3, 9.4
 * 
 * Returns all candidates sorted by fit_score (highest first) with:
 * - name, fit_score, no_show_risk, shortlist_status, interview_status
 * - Supports sorting and filtering via query parameters
 * - Includes buffer_rank for buffer candidates
 * - Provides metadata for frontend highlighting
 * 
 * Query Parameters:
 * - sortBy: field to sort by (fit_score, rank, name, no_show_risk) - default: fit_score
 * - sortOrder: asc or desc - default: desc for fit_score, asc for others
 * - filterStatus: comma-separated shortlist_status values (shortlisted, buffer, pending, rejected)
 * - filterInterview: comma-separated interview_status values (invitation_sent, confirmed, etc.)
 */
export const getRankedCandidates = catchAsyncErrors(async (req, res, next) => {
  const { jobId } = req.params;
  const { 
    sortBy = 'fit_score', 
    sortOrder, 
    filterStatus, 
    filterInterview 
  } = req.query;

  if (!jobId) {
    return next(new ErrorHandler("Job ID is required", 400));
  }

  // Validate sortBy parameter
  const validSortFields = ['fit_score', 'rank', 'name', 'no_show_risk'];
  if (!validSortFields.includes(sortBy)) {
    return next(new ErrorHandler(`Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`, 400));
  }

  // Fetch job details to get buffer configuration
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("number_of_openings, shortlisting_buffer")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return next(new ErrorHandler("Job not found", 404));
  }

  // Build query for applications with interview data
  let query = supabase
    .from("applications")
    .select(`
      id,
      name,
      email,
      fit_score,
      rank,
      shortlist_status,
      ai_processed,
      summary,
      applicant_id,
      interviews (
        id,
        status,
        no_show_risk,
        scheduled_time,
        confirmation_deadline,
        slot_selection_deadline
      )
    `)
    .eq("job_id", jobId);

  // Apply shortlist_status filter if provided
  if (filterStatus) {
    const statusFilters = filterStatus.split(',').map(s => s.trim());
    query = query.in('shortlist_status', statusFilters);
  }

  // Fetch applications
  const { data: applications, error } = await query;

  if (error) {
    return next(new ErrorHandler(`Failed to fetch candidates: ${error.message}`, 500));
  }

  // Transform data to include interview_status, no_show_risk, and buffer_rank at top level
  let candidates = applications.map(app => {
    const interview = app.interviews && app.interviews.length > 0 ? app.interviews[0] : null;
    
    // Calculate buffer_rank for buffer candidates
    // buffer_rank is the position within the buffer pool (1, 2, 3, etc.)
    let buffer_rank = null;
    if (app.shortlist_status === 'buffer' && app.rank) {
      // Buffer rank starts after shortlisted candidates
      buffer_rank = app.rank - job.number_of_openings;
    }
    
    return {
      id: app.id,
      name: app.name,
      email: app.email,
      fit_score: app.fit_score,
      rank: app.rank,
      shortlist_status: app.shortlist_status,
      buffer_rank: buffer_rank,
      ai_processed: app.ai_processed,
      summary: app.summary,
      applicant_id: app.applicant_id,
      interview_status: interview ? interview.status : null,
      no_show_risk: interview ? interview.no_show_risk : null,
      scheduled_time: interview ? interview.scheduled_time : null,
      confirmation_deadline: interview ? interview.confirmation_deadline : null,
      slot_selection_deadline: interview ? interview.slot_selection_deadline : null,
      interview_id: interview ? interview.id : null
    };
  });

  // Apply interview_status filter if provided
  if (filterInterview) {
    const interviewFilters = filterInterview.split(',').map(s => s.trim());
    candidates = candidates.filter(c => 
      c.interview_status && interviewFilters.includes(c.interview_status)
    );
  }

  // Apply sorting
  const defaultSortOrder = sortBy === 'fit_score' ? 'desc' : 'asc';
  const finalSortOrder = sortOrder || defaultSortOrder;
  const ascending = finalSortOrder === 'asc';

  candidates.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle null values - push to end
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // For string comparison (name)
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
      return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    // For numeric comparison
    return ascending ? aVal - bVal : bVal - aVal;
  });

  // Generate metadata for frontend highlighting
  const metadata = {
    job: {
      number_of_openings: job.number_of_openings,
      shortlisting_buffer: job.shortlisting_buffer
    },
    counts: {
      total: candidates.length,
      shortlisted: candidates.filter(c => c.shortlist_status === 'shortlisted').length,
      buffer: candidates.filter(c => c.shortlist_status === 'buffer').length,
      pending: candidates.filter(c => c.shortlist_status === 'pending').length,
      rejected: candidates.filter(c => c.shortlist_status === 'rejected').length
    },
    highlighting: {
      shortlisted_ids: candidates
        .filter(c => c.shortlist_status === 'shortlisted')
        .map(c => c.id),
      buffer_ids: candidates
        .filter(c => c.shortlist_status === 'buffer')
        .map(c => c.id),
      high_risk_ids: candidates
        .filter(c => c.no_show_risk && c.no_show_risk > 0.7)
        .map(c => c.id)
    }
  };

  res.status(200).json({
    success: true,
    candidates,
    count: candidates.length,
    metadata,
    filters: {
      sortBy,
      sortOrder: finalSortOrder,
      filterStatus: filterStatus || null,
      filterInterview: filterInterview || null
    }
  });
});

/**
 * Get automation activity log for a job
 * Requirements: 9.5, 9.6
 * 
 * Returns recent automation actions with:
 * - timestamp, action_type, candidate name, outcome
 * - Supports filtering by action_type and date range
 * - Includes action_type metadata for frontend (icons, colors, descriptions)
 * 
 * Query Parameters:
 * - limit: Number of logs to return (default: 50, max: 200)
 * - offset: Pagination offset (default: 0)
 * - action_type: Comma-separated action types to filter (e.g., "invitation_sent,buffer_promotion")
 * - startDate: ISO8601 date to filter logs from (inclusive)
 * - endDate: ISO8601 date to filter logs to (inclusive)
 */
export const getActivityLog = catchAsyncErrors(async (req, res, next) => {
  const { jobId } = req.params;
  const { 
    limit = 50, 
    offset = 0, 
    action_type, 
    startDate, 
    endDate 
  } = req.query;

  if (!jobId) {
    return next(new ErrorHandler("Job ID is required", 400));
  }

  // Validate and cap limit
  const parsedLimit = Math.min(parseInt(limit), 200);
  const parsedOffset = parseInt(offset);

  // Build query
  let query = supabase
    .from("automation_logs")
    .select("*", { count: "exact" })
    .eq("job_id", jobId);

  // Apply action_type filter if provided
  if (action_type) {
    const actionTypes = action_type.split(',').map(t => t.trim());
    query = query.in('action_type', actionTypes);
  }

  // Apply date range filters
  if (startDate) {
    try {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query = query.gte('created_at', start.toISOString());
      }
    } catch (e) {
      return next(new ErrorHandler("Invalid startDate format. Use ISO8601 format.", 400));
    }
  }

  if (endDate) {
    try {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }
    } catch (e) {
      return next(new ErrorHandler("Invalid endDate format. Use ISO8601 format.", 400));
    }
  }

  // Execute query with ordering and pagination
  query = query
    .order("created_at", { ascending: false })
    .range(parsedOffset, parsedOffset + parsedLimit - 1);

  const { data: logs, error, count } = await query;

  if (error) {
    return next(new ErrorHandler(`Failed to fetch activity log: ${error.message}`, 500));
  }

  // Action type metadata for frontend rendering
  const actionTypeMetadata = {
    invitation_sent: {
      label: "Invitation Sent",
      icon: "mail",
      color: "blue",
      category: "interview",
      description: "Interview invitation sent to candidate"
    },
    invitation_expired: {
      label: "Invitation Expired",
      icon: "clock",
      color: "orange",
      category: "expiration",
      description: "Candidate did not respond to invitation within deadline"
    },
    slot_selection_expired: {
      label: "Slot Selection Expired",
      icon: "clock",
      color: "orange",
      category: "expiration",
      description: "Candidate did not select interview slot within deadline"
    },
    buffer_promotion: {
      label: "Buffer Promotion",
      icon: "arrow-up",
      color: "green",
      category: "promotion",
      description: "Candidate promoted from buffer to shortlist"
    },
    buffer_backfill: {
      label: "Buffer Backfill",
      icon: "refresh",
      color: "purple",
      category: "maintenance",
      description: "Buffer pool replenished with pending candidates"
    },
    auto_shortlist: {
      label: "Auto-Shortlist",
      icon: "star",
      color: "yellow",
      category: "shortlisting",
      description: "Candidates automatically shortlisted based on fit scores"
    },
    slot_confirmed: {
      label: "Slot Confirmed",
      icon: "check",
      color: "green",
      category: "interview",
      description: "Interview slot confirmed by candidate"
    },
    interview_cancelled: {
      label: "Interview Cancelled",
      icon: "x",
      color: "red",
      category: "cancellation",
      description: "Interview cancelled by candidate or recruiter"
    },
    negotiation_started: {
      label: "Negotiation Started",
      icon: "message-circle",
      color: "blue",
      category: "negotiation",
      description: "Candidate started slot negotiation with bot"
    },
    negotiation_escalated: {
      label: "Negotiation Escalated",
      icon: "alert-triangle",
      color: "orange",
      category: "negotiation",
      description: "Negotiation escalated to recruiter after multiple rounds"
    },
    risk_score_updated: {
      label: "Risk Score Updated",
      icon: "activity",
      color: "purple",
      category: "risk",
      description: "No-show risk score recalculated"
    },
    background_cycle: {
      label: "Background Cycle",
      icon: "refresh-cw",
      color: "gray",
      category: "system",
      description: "Automated background scheduler cycle completed"
    }
  };

  // Enrich logs with candidate names and metadata
  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      let candidateName = null;
      let candidateId = null;

      // Extract candidate_id from details
      if (log.details) {
        candidateId = log.details.candidate_id || log.details.promoted_candidate_id;
        
        if (candidateId) {
          // Fetch candidate name from users table
          const { data: user } = await supabase
            .from("users")
            .select("name")
            .eq("id", candidateId)
            .single();
          
          if (user) {
            candidateName = user.name;
          }
        }
      }

      // Format outcome based on action type and details
      let outcome = "completed";
      if (log.details) {
        if (log.details.reason) {
          outcome = log.details.reason;
        } else if (log.details.outcome) {
          outcome = log.details.outcome;
        } else if (log.action_type === 'buffer_promotion') {
          outcome = `Promoted to rank ${log.details.promoted_to_rank || log.details.new_rank || 'N/A'}`;
        } else if (log.action_type === 'invitation_sent') {
          outcome = "Invitation delivered";
        } else if (log.action_type === 'auto_shortlist') {
          outcome = `${log.details.shortlisted_count || 0} candidates shortlisted`;
        }
      }

      // Get metadata for this action type
      const metadata = actionTypeMetadata[log.action_type] || {
        label: log.action_type,
        icon: "info",
        color: "gray",
        category: "other",
        description: "Automation action"
      };

      return {
        id: log.id,
        action_type: log.action_type,
        trigger_source: log.trigger_source,
        timestamp: log.created_at,
        candidate_name: candidateName,
        candidate_id: candidateId,
        details: log.details,
        outcome: outcome,
        metadata: metadata
      };
    })
  );

  // Calculate summary statistics for the filtered logs
  const summary = {
    total_actions: count,
    by_category: {},
    by_trigger: {
      auto: enrichedLogs.filter(l => l.trigger_source === 'auto').length,
      manual: enrichedLogs.filter(l => l.trigger_source === 'manual').length,
      scheduled: enrichedLogs.filter(l => l.trigger_source === 'scheduled').length
    }
  };

  // Group by category
  enrichedLogs.forEach(log => {
    const category = log.metadata.category;
    summary.by_category[category] = (summary.by_category[category] || 0) + 1;
  });

  res.status(200).json({
    success: true,
    logs: enrichedLogs,
    count: count,
    pagination: {
      limit: parsedLimit,
      offset: parsedOffset,
      total: count,
      has_more: parsedOffset + parsedLimit < count
    },
    filters: {
      action_type: action_type || null,
      startDate: startDate || null,
      endDate: endDate || null
    },
    summary: summary,
    available_action_types: Object.keys(actionTypeMetadata)
  });
});

/**
 * Get analytics metrics for a job
 * Requirements: 9.7, 9.8, 9.9
 * 
 * Returns calculated analytics:
 * - time_saved (hours) with detailed breakdown by action type
 * - automation_success_rate (%) with trend comparison
 * - average_time_to_interview (days) with distribution
 * - buffer_health_indicator with granular status levels
 * - response_rate (%) - candidate engagement metric
 * - average_negotiation_rounds - complexity indicator
 * - no_show_rate (%) - reliability metric
 * - trend_data - comparison with previous period
 */
export const getAnalytics = catchAsyncErrors(async (req, res, next) => {
  const { jobId } = req.params;

  if (!jobId) {
    return next(new ErrorHandler("Job ID is required", 400));
  }

  // Fetch job details
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return next(new ErrorHandler("Job not found", 404));
  }

  // Fetch all applications for the job
  const { data: applications, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("job_id", jobId);

  if (appsError) {
    return next(new ErrorHandler(`Failed to fetch applications: ${appsError.message}`, 500));
  }

  // Fetch all interviews for the job
  const { data: interviews, error: interviewsError } = await supabase
    .from("interviews")
    .select("*")
    .eq("job_id", jobId);

  if (interviewsError) {
    return next(new ErrorHandler(`Failed to fetch interviews: ${interviewsError.message}`, 500));
  }

  // Fetch automation logs for the job
  const { data: logs, error: logsError } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (logsError) {
    return next(new ErrorHandler(`Failed to fetch logs: ${logsError.message}`, 500));
  }

  // Fetch negotiation sessions for the job
  const { data: negotiations, error: negotiationsError } = await supabase
    .from("negotiation_sessions")
    .select("*")
    .in("interview_id", interviews.map(i => i.id));

  // Calculate metrics

  // 1. Time Saved (hours) - Enhanced with detailed breakdown
  // Refined estimates based on typical recruiter workflows:
  // - Resume review and ranking: 5 minutes per application (0.083 hours)
  // - Auto-shortlisting: 2 hours per job (includes decision-making, documentation)
  // - Auto-invitation: 15 minutes per invitation (0.25 hours) - drafting, sending, tracking
  // - Auto-promotion: 1.5 hours per promotion (includes candidate search, communication)
  // - Slot negotiation: 30 minutes per negotiation (0.5 hours) - back-and-forth emails
  // - Calendar coordination: 20 minutes per confirmed interview (0.33 hours)
  // - Deadline monitoring: 10 minutes per expiration handled (0.17 hours)
  
  const aiProcessedCount = applications.filter(a => a.ai_processed).length;
  const autoShortlistCount = logs.filter(l => l.action_type === 'auto_shortlist').length;
  const invitationCount = logs.filter(l => l.action_type === 'invitation_sent' && l.trigger_source === 'auto').length;
  const promotionCount = logs.filter(l => l.action_type === 'buffer_promotion').length;
  const negotiationCount = logs.filter(l => l.action_type === 'negotiation_started').length;
  const confirmedCount = interviews.filter(i => i.status === 'confirmed' || i.status === 'completed').length;
  const expirationCount = logs.filter(l => 
    l.action_type === 'invitation_expired' || l.action_type === 'slot_selection_expired'
  ).length;

  const timeSavedBreakdown = {
    resume_processing: parseFloat((aiProcessedCount * 0.083).toFixed(2)),
    auto_shortlisting: parseFloat((autoShortlistCount * 2).toFixed(2)),
    auto_invitations: parseFloat((invitationCount * 0.25).toFixed(2)),
    buffer_promotions: parseFloat((promotionCount * 1.5).toFixed(2)),
    slot_negotiations: parseFloat((negotiationCount * 0.5).toFixed(2)),
    calendar_coordination: parseFloat((confirmedCount * 0.33).toFixed(2)),
    deadline_monitoring: parseFloat((expirationCount * 0.17).toFixed(2))
  };

  const totalTimeSaved = Object.values(timeSavedBreakdown).reduce((sum, val) => sum + val, 0);

  // 2. Automation Success Rate (%) - Enhanced with funnel analysis
  // Success = interviews that reached confirmed or completed status
  // Total = all interviews created
  const totalInterviews = interviews.length;
  const invitationSentCount = interviews.filter(i => i.status === 'invitation_sent').length;
  const slotPendingCount = interviews.filter(i => i.status === 'slot_pending').length;
  const confirmedInterviews = interviews.filter(i => i.status === 'confirmed').length;
  const completedInterviews = interviews.filter(i => i.status === 'completed').length;
  const cancelledCount = interviews.filter(i => i.status === 'cancelled').length;
  const expiredCount = interviews.filter(i => i.status === 'expired').length;
  const noShowCount = interviews.filter(i => i.status === 'no_show').length;

  const successfulInterviews = confirmedInterviews + completedInterviews;
  const automationSuccessRate = totalInterviews > 0 
    ? (successfulInterviews / totalInterviews) * 100 
    : 0;

  // Calculate conversion rates at each stage
  const invitationResponseRate = totalInterviews > 0
    ? ((totalInterviews - invitationSentCount - expiredCount) / totalInterviews) * 100
    : 0;

  const slotSelectionRate = totalInterviews > 0
    ? ((successfulInterviews + slotPendingCount) / totalInterviews) * 100
    : 0;

  // 3. Average Time to Interview (days) - Enhanced with distribution
  // Calculate time from application submission to interview confirmation
  const confirmedOrCompletedInterviews = interviews.filter(
    i => i.status === 'confirmed' || i.status === 'completed'
  );
  
  let totalDays = 0;
  let validInterviewCount = 0;
  const timeToInterviewDistribution = [];

  for (const interview of confirmedOrCompletedInterviews) {
    const application = applications.find(a => a.id === interview.application_id);
    if (application && application.created_at && interview.scheduled_time) {
      const appDate = new Date(application.created_at);
      const interviewDate = new Date(interview.scheduled_time);
      const daysDiff = (interviewDate - appDate) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0) {
        totalDays += daysDiff;
        validInterviewCount++;
        timeToInterviewDistribution.push(daysDiff);
      }
    }
  }

  const averageTimeToInterview = validInterviewCount > 0 
    ? totalDays / validInterviewCount 
    : 0;

  // Calculate median and percentiles for distribution
  timeToInterviewDistribution.sort((a, b) => a - b);
  const medianTimeToInterview = validInterviewCount > 0
    ? timeToInterviewDistribution[Math.floor(validInterviewCount / 2)]
    : 0;

  const p25 = validInterviewCount > 0
    ? timeToInterviewDistribution[Math.floor(validInterviewCount * 0.25)]
    : 0;

  const p75 = validInterviewCount > 0
    ? timeToInterviewDistribution[Math.floor(validInterviewCount * 0.75)]
    : 0;

  // 4. Buffer Health Indicator - Enhanced with granular status
  const bufferCandidates = applications.filter(a => a.shortlist_status === 'buffer');
  const currentBufferSize = bufferCandidates.length;
  const targetBufferSize = job.shortlisting_buffer || job.number_of_openings;
  
  let bufferHealthStatus = 'empty';
  let bufferHealthColor = 'red';
  let bufferHealthPercentage = 0;

  if (targetBufferSize > 0) {
    bufferHealthPercentage = (currentBufferSize / targetBufferSize) * 100;
    
    if (bufferHealthPercentage >= 100) {
      bufferHealthStatus = 'full';
      bufferHealthColor = 'green';
    } else if (bufferHealthPercentage >= 75) {
      bufferHealthStatus = 'healthy';
      bufferHealthColor = 'green';
    } else if (bufferHealthPercentage >= 50) {
      bufferHealthStatus = 'partial';
      bufferHealthColor = 'yellow';
    } else if (bufferHealthPercentage >= 25) {
      bufferHealthStatus = 'low';
      bufferHealthColor = 'orange';
    } else if (bufferHealthPercentage > 0) {
      bufferHealthStatus = 'critical';
      bufferHealthColor = 'red';
    } else {
      bufferHealthStatus = 'empty';
      bufferHealthColor = 'red';
    }
  }

  // Calculate buffer utilization rate (how often buffer is used)
  const bufferPromotionRate = promotionCount > 0 && currentBufferSize > 0
    ? (promotionCount / (promotionCount + currentBufferSize)) * 100
    : 0;

  // 5. Response Rate (%) - Candidate engagement metric
  // Percentage of candidates who responded to invitations (accepted or rejected)
  const respondedCount = interviews.filter(i => 
    i.status !== 'invitation_sent' && i.status !== 'expired'
  ).length;
  const responseRate = totalInterviews > 0
    ? (respondedCount / totalInterviews) * 100
    : 0;

  // 6. Average Negotiation Rounds - Complexity indicator
  let totalNegotiationRounds = 0;
  let negotiationSessionCount = 0;

  if (negotiations && !negotiationsError) {
    negotiationSessionCount = negotiations.length;
    totalNegotiationRounds = negotiations.reduce((sum, n) => sum + (n.round || 1), 0);
  }

  const averageNegotiationRounds = negotiationSessionCount > 0
    ? totalNegotiationRounds / negotiationSessionCount
    : 0;

  const escalatedNegotiations = negotiations && !negotiationsError
    ? negotiations.filter(n => n.state === 'escalated').length
    : 0;

  const negotiationEscalationRate = negotiationSessionCount > 0
    ? (escalatedNegotiations / negotiationSessionCount) * 100
    : 0;

  // 7. No-Show Rate (%) - Reliability metric
  const noShowRate = completedInterviews + noShowCount > 0
    ? (noShowCount / (completedInterviews + noShowCount)) * 100
    : 0;

  // Calculate average no-show risk for confirmed interviews
  const confirmedWithRisk = interviews.filter(i => 
    (i.status === 'confirmed' || i.status === 'completed') && i.no_show_risk !== null
  );
  const averageNoShowRisk = confirmedWithRisk.length > 0
    ? confirmedWithRisk.reduce((sum, i) => sum + i.no_show_risk, 0) / confirmedWithRisk.length
    : 0;

  // 8. Trend Data - Comparison with previous period
  // Calculate metrics for last 7 days vs previous 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentLogs = logs.filter(l => new Date(l.created_at) >= sevenDaysAgo);
  const previousLogs = logs.filter(l => {
    const date = new Date(l.created_at);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });

  const recentInterviews = interviews.filter(i => new Date(i.created_at) >= sevenDaysAgo);
  const previousInterviews = interviews.filter(i => {
    const date = new Date(i.created_at);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });

  const recentSuccessRate = recentInterviews.length > 0
    ? (recentInterviews.filter(i => i.status === 'confirmed' || i.status === 'completed').length / recentInterviews.length) * 100
    : 0;

  const previousSuccessRate = previousInterviews.length > 0
    ? (previousInterviews.filter(i => i.status === 'confirmed' || i.status === 'completed').length / previousInterviews.length) * 100
    : 0;

  const successRateTrend = previousSuccessRate > 0
    ? ((recentSuccessRate - previousSuccessRate) / previousSuccessRate) * 100
    : 0;

  const recentActivityCount = recentLogs.length;
  const previousActivityCount = previousLogs.length;
  const activityTrend = previousActivityCount > 0
    ? ((recentActivityCount - previousActivityCount) / previousActivityCount) * 100
    : 0;

  // Additional metrics
  const shortlistedCount = applications.filter(a => a.shortlist_status === 'shortlisted').length;
  const pendingCount = applications.filter(a => a.shortlist_status === 'pending').length;
  const rejectedCount = applications.filter(a => a.shortlist_status === 'rejected').length;

  res.status(200).json({
    success: true,
    analytics: {
      // Core metrics (Requirements 9.7, 9.8, 9.9)
      time_saved_hours: parseFloat(totalTimeSaved.toFixed(2)),
      time_saved_breakdown: timeSavedBreakdown,
      automation_success_rate: parseFloat(automationSuccessRate.toFixed(2)),
      average_time_to_interview_days: parseFloat(averageTimeToInterview.toFixed(2)),
      
      // Enhanced time-to-interview metrics
      time_to_interview_distribution: {
        median: parseFloat(medianTimeToInterview.toFixed(2)),
        p25: parseFloat(p25.toFixed(2)),
        p75: parseFloat(p75.toFixed(2)),
        min: timeToInterviewDistribution.length > 0 ? parseFloat(timeToInterviewDistribution[0].toFixed(2)) : 0,
        max: timeToInterviewDistribution.length > 0 ? parseFloat(timeToInterviewDistribution[timeToInterviewDistribution.length - 1].toFixed(2)) : 0
      },
      
      // Enhanced buffer health
      buffer_health: {
        status: bufferHealthStatus,
        color: bufferHealthColor,
        current_size: currentBufferSize,
        target_size: targetBufferSize,
        percentage: parseFloat(bufferHealthPercentage.toFixed(2)),
        utilization_rate: parseFloat(bufferPromotionRate.toFixed(2)),
        available_candidates: pendingCount
      },
      
      // Funnel metrics
      conversion_funnel: {
        invitation_response_rate: parseFloat(invitationResponseRate.toFixed(2)),
        slot_selection_rate: parseFloat(slotSelectionRate.toFixed(2)),
        confirmation_rate: parseFloat(automationSuccessRate.toFixed(2))
      },
      
      // Additional useful metrics
      response_rate: parseFloat(responseRate.toFixed(2)),
      average_negotiation_rounds: parseFloat(averageNegotiationRounds.toFixed(2)),
      negotiation_escalation_rate: parseFloat(negotiationEscalationRate.toFixed(2)),
      no_show_rate: parseFloat(noShowRate.toFixed(2)),
      average_no_show_risk: parseFloat(averageNoShowRisk.toFixed(2)),
      
      // Trend data (comparison with previous period)
      trends: {
        success_rate_change: parseFloat(successRateTrend.toFixed(2)),
        activity_change: parseFloat(activityTrend.toFixed(2)),
        recent_period: {
          interviews: recentInterviews.length,
          success_rate: parseFloat(recentSuccessRate.toFixed(2)),
          activities: recentActivityCount
        },
        previous_period: {
          interviews: previousInterviews.length,
          success_rate: parseFloat(previousSuccessRate.toFixed(2)),
          activities: previousActivityCount
        }
      },
      
      // Candidate breakdown
      candidate_breakdown: {
        total: applications.length,
        shortlisted: shortlistedCount,
        buffer: currentBufferSize,
        pending: pendingCount,
        rejected: rejectedCount
      },
      
      // Interview breakdown
      interview_breakdown: {
        total: totalInterviews,
        invitation_sent: invitationSentCount,
        slot_pending: slotPendingCount,
        confirmed: confirmedInterviews,
        completed: completedInterviews,
        cancelled: cancelledCount,
        expired: expiredCount,
        no_show: noShowCount
      },
      
      // Automation actions summary
      automation_actions: {
        total: logs.length,
        resume_processing: aiProcessedCount,
        auto_shortlist: autoShortlistCount,
        invitations_sent: invitationCount,
        buffer_promotions: promotionCount,
        negotiations: negotiationCount,
        expirations_handled: expirationCount
      }
    }
  });
});
