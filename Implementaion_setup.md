# AI Hiring Orchestrator – Vibe Agent Implementation Spec

## Objective
Upgrade the existing job portal into a fully automated AI Hiring Orchestrator with:

- Resume scoring & ranking
- Openings-based shortlisting
- Dynamic buffer replacement
- Automated interview scheduling
- Negotiation chatbot
- Calendar synchronization
- Auto-confirmation workflows
- Background automation engine

---

# 1. CURRENT SYSTEM (DO NOT BREAK)

Already implemented:

- Recruiter login
- Candidate login
- Job posting
- Job application
- Resume stored in Cloudinary
- Recruiter can view/download resumes
- Manual accept/reject

All new features must be layered on top.

---

# 2. DATABASE CHANGES

## 2.1 Jobs Table (Add Fields)

- number_of_openings INTEGER NOT NULL
- shortlisting_buffer INTEGER DEFAULT (number_of_openings * 2)

---

## 2.2 Applications Table (Add Fields)

- fit_score INTEGER
- rank INTEGER
- summary TEXT
- shortlist_status ENUM('pending','shortlisted','buffer','rejected')
- ai_processed BOOLEAN DEFAULT FALSE

---

## 2.3 Interviews Table (New)

- id PRIMARY KEY
- candidate_id (FK)
- recruiter_id (FK)
- job_id (FK)
- rank_at_time INTEGER
- scheduled_time TIMESTAMP
- status ENUM('invited','awaiting_slot','scheduled','cancelled','expired')
- confirmation_deadline TIMESTAMP
- calendar_event_id TEXT
- no_show_risk INTEGER

---

# 3. RESUME INTELLIGENCE ENGINE

## Trigger
On job application submission.

## Steps
1. Fetch resume from Cloudinary
2. Extract text (PDF parser)
3. Extract:
   - skills
   - experience
   - keywords
4. Compare with job description
5. Compute Fit Score:

Fit Score =
(skill_overlap * 0.5) +
(experience_match * 0.3) +
(keyword_relevance * 0.2)

6. Generate short resume summary using LLM
7. Store:
   - fit_score
   - summary
   - ai_processed = true

---

# 4. RANKING ENGINE

## Trigger
When:
- New application added
- Recruiter clicks "Recalculate Ranking"

## Logic
1. Fetch all applications for job
2. Sort by fit_score DESC
3. Assign rank sequentially

---

# 5. SHORTLISTING LOGIC

## Trigger
When recruiter clicks "Auto Shortlist"

## Logic
Let N = number_of_openings

1. Top N → shortlist_status = 'shortlisted'
2. Next N → shortlist_status = 'buffer'
3. Others → 'pending'

Create interview records for shortlisted candidates.

---

# 6. RECRUITER CONFIRMATION TIMER

When shortlist created:

- Set confirmation_deadline = now + X hours
- Send notification to recruiter

If recruiter does NOT confirm before deadline:

- Auto-confirm
- Send invitations to candidates

---

# 7. INVITATION EMAIL FLOW

Email contains:

- Accept link
- Reject link

---

## 7.1 If Candidate Accepts

1. Show available slots (from recruiter Google Calendar)
2. Candidate must choose within Y hours
3. Update interview.status = 'awaiting_slot'

If no slot selected before deadline:
- Mark interview expired
- Promote next buffer candidate

---

## 7.2 If Candidate Rejects

Redirect to Negotiation Chatbot

---

# 8. NEGOTIATION CHATBOT

## Capabilities

- Read recruiter availability
- Suggest alternate slots
- Accept user proposed times
- Check for conflicts
- Finalize mutually available slot

If agreement:
- Create calendar event
- Update interview.status = 'scheduled'

If no agreement:
- Mark rejected
- Promote buffer candidate

---

# 9. BUFFER PROMOTION ENGINE

## Trigger Conditions

- Candidate rejects
- Candidate misses deadline
- Candidate cancels
- Interview expired

## Logic

1. Find highest-ranked candidate with shortlist_status = 'buffer'
2. Promote to 'shortlisted'
3. Create interview record
4. Send invitation

---

# 10. GOOGLE CALENDAR INTEGRATION

On slot confirmation:

1. Create event
2. Invite recruiter + candidate
3. Save calendar_event_id
4. Update interview.status = 'scheduled'

---

# 11. NO-SHOW RISK ENGINE

## Example Rules

- Reply delay > 24h → +20
- Rescheduled → +30
- Early Monday slot → +10

Return:
- Risk score (0–100)
- Risk category (Low/Medium/High)

Store in interview.no_show_risk

---

# 12. BACKGROUND AUTOMATION SCHEDULER

Runs every X minutes.

Must check:

- Recruiter confirmation deadlines
- Candidate slot deadlines
- Expired invitations
- Buffer promotions
- Calendar sync

This makes system self-healing.

---

# 13. RECRUITER DASHBOARD REQUIREMENTS

## Panel 1 – Ranked Candidates

Display:
- Rank
- Name
- Fit Score
- Risk Score
- Status

## Panel 2 – Automation Activity Log

Log events:
- Resume scored
- Shortlisted
- Email sent
- Slot selected
- Calendar event created
- Buffer promoted

## Panel 3 – Analytics

- Interviews automated
- Auto confirmations triggered
- Buffer promotions triggered
- Time saved estimate
- Automation success %

---

# 14. END-TO-END FLOW SUMMARY

1. Recruiter posts job with number_of_openings
2. Candidates apply
3. Resume scored + ranked
4. Top N shortlisted
5. Recruiter confirms (or auto-confirm)
6. Invitations sent
7. Candidate:
   - Accept → choose slot
   - Reject → chatbot negotiation
8. Calendar updated
9. If dropout → buffer promoted
10. Continue until openings filled

---

# 15. IMPLEMENTATION PRIORITY ORDER

Phase 1:
- Resume parsing
- Fit scoring
- Ranking UI

Phase 2:
- Shortlisting + buffer logic
- Confirmation timer

Phase 3:
- Email invitations
- Slot selection UI
- Calendar integration

Phase 4:
- Negotiation chatbot
- Background scheduler

Phase 5:
- No-show risk
- Analytics dashboard

---

# NON-NEGOTIABLE SYSTEM RULES

- Never exceed number_of_openings
- Always maintain active buffer
- Always auto-promote on failure
- Never block hiring due to recruiter delay
- Always log automation actions

---

# SUCCESS CRITERIA

System must:

- Automatically fill openings
- Handle dropouts without manual intervention
- Avoid calendar conflicts
- Minimize recruiter effort
- Maintain accurate ranking integrity