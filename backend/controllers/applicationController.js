import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/error.js";
import { supabase } from "../database/supabaseClient.js";
import cloudinary from "cloudinary";
import validator from "validator";
import axios from "axios";

// Python service URL from environment or default
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

/**
 * Async function to process resume via Python service
 * This runs in the background without blocking the application submission response
 */
async function processResumeAsync(applicationId, resumeUrl, jobDescription) {
  try {
    console.log(`Starting async resume processing for application ${applicationId}`);
    
    // Call Python service to process resume
    const response = await axios.post(
      `${PYTHON_SERVICE_URL}/api/python/process-resume`,
      {
        application_id: applicationId,
        resume_url: resumeUrl,
        job_description: jobDescription
      },
      {
        timeout: 30000 // 30 second timeout as per requirements
      }
    );

    if (response.data.success) {
      // Store fit_score, summary, and extracted features in applications table
      const { fit_score, summary, extracted_features } = response.data;
      
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          fit_score: fit_score,
          summary: summary,
          ai_processed: true,
          // Store extracted features as JSONB if needed, or in separate columns
          // For now, we'll just store the core fields
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error(`Error updating application ${applicationId}:`, updateError);
      } else {
        console.log(`Successfully processed application ${applicationId} with fit_score: ${fit_score}`);
      }
    } else {
      throw new Error(response.data.error || 'Resume processing failed');
    }
  } catch (error) {
    console.error(`Error processing resume for application ${applicationId}:`, error.message);
    
    // Set fit_score to 0 on failure as per requirements
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        fit_score: 0,
        ai_processed: true,
        summary: 'Resume processing failed'
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error(`Error updating failed application ${applicationId}:`, updateError);
    }
  }
}


export const postApplication = catchAsyncErrors(async (req, res, next) => {
  const { role } = req.user;
  
  if (role === "Employer") {
    return next(
      new ErrorHandler("Employer not allowed to access this resource.", 400)
    );
  }

  if (!req.files || Object.keys(req.files).length === 0) {
    return next(new ErrorHandler("Resume File Required!", 400));
  }

  const { resume } = req.files;
  const allowedFormats = ["application/pdf"];
  
  if (!allowedFormats.includes(resume.mimetype)) {
    return next(
      new ErrorHandler("Invalid file type. Please upload a PDF file.", 400)
    );
  }

  try {
    const cloudinaryResponse = await cloudinary.v2.uploader.upload(
      resume.tempFilePath,
      {
        resource_type: "raw",
        folder: "resumes",
        public_id: `resume_${Date.now()}`,
        use_filename: false,
        unique_filename: true,
        overwrite: true,
        type: "upload"
      }
    );

    console.log("Cloudinary upload response:", JSON.stringify(cloudinaryResponse, null, 2));

    const resumeUrl = cloudinaryResponse.secure_url;
    
    const { name, email, coverLetter, phone, address, jobId } = req.body;

    // Validate email
    if (!validator.isEmail(email)) {
      return next(new ErrorHandler("Please provide a valid Email!"));
    }

    if (!jobId) {
      return next(new ErrorHandler("Job not found!", 404));
    }

    // Get job details
    const { data: jobDetails, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !jobDetails) {
      return next(new ErrorHandler("Job not found!", 404));
    }

    if (
      !name ||
      !email ||
      !coverLetter ||
      !phone ||
      !address ||
      !resume
    ) {
      return next(new ErrorHandler("Please fill all fields.", 400));
    }

    // Create application
    const { data: application, error } = await supabase
      .from('applications')
      .insert([
        {
          name,
          email,
          cover_letter: coverLetter,
          phone: parseInt(phone),
          address,
          applicant_id: req.user.id,
          applicant_role: "Job Seeker",
          employer_id: jobDetails.posted_by,
          employer_role: "Employer",
          resume_public_id: cloudinaryResponse.public_id,
          resume_url: cloudinaryResponse.secure_url,
          job_id: jobId, // Add job_id to link application to job
        }
      ])
      .select()
      .single();

    if (error) {
      return next(new ErrorHandler(error.message, 500));
    }

    // Trigger async resume processing (non-blocking)
    // This runs in the background and doesn't block the response
    processResumeAsync(application.id, application.resume_url, jobDetails.description)
      .catch(err => {
        // Log error but don't fail the request
        console.error('Background resume processing error:', err);
      });

    res.status(200).json({
      success: true,
      message: "Application Submitted!",
      application,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

export const employerGetAllApplications = catchAsyncErrors(
  async (req, res, next) => {
    const { role } = req.user;
    
    if (role === "Job Seeker") {
      return next(
        new ErrorHandler("Job Seeker not allowed to access this resource.", 400)
      );
    }

    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .eq('employer_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return next(new ErrorHandler(error.message, 500));
    }

    res.status(200).json({
      success: true,
      applications,
    });
  }
);

export const jobseekerGetAllApplications = catchAsyncErrors(
  async (req, res, next) => {
    const { role } = req.user;
    
    if (role === "Employer") {
      return next(
        new ErrorHandler("Employer not allowed to access this resource.", 400)
      );
    }

    const { data: applications, error } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return next(new ErrorHandler(error.message, 500));
    }

    res.status(200).json({
      success: true,
      applications,
    });
  }
);

export const jobseekerDeleteApplication = catchAsyncErrors(
  async (req, res, next) => {
    const { role } = req.user;
    
    if (role === "Employer") {
      return next(
        new ErrorHandler("Employer not allowed to access this resource.", 400)
      );
    }

    const { id } = req.params;

    // Get application
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !application) {
      return next(new ErrorHandler("Application not found!", 404));
    }

    // Verify ownership
    if (application.applicant_id !== req.user.id) {
      return next(new ErrorHandler("Not authorized to delete this application.", 403));
    }

    // Check if application status is not pending
    if (application.status !== "pending") {
      return next(
        new ErrorHandler("Cannot delete application after it has been processed.", 400)
      );
    }

    const { error: deleteError } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return next(new ErrorHandler(deleteError.message, 500));
    }

    res.status(200).json({
      success: true,
      message: "Application Deleted!",
    });
  }
);

export const updateApplicationStatus = catchAsyncErrors(async (req, res, next) => {
  const { role } = req.user;
  
  if (role === "Job Seeker") {
    return next(
      new ErrorHandler("Job Seeker not allowed to access this resource.", 400)
    );
  }

  const { id } = req.params;
  const { status } = req.body;

  // Only allow accepted or rejected status updates
  if (!["accepted", "rejected"].includes(status)) {
    return next(new ErrorHandler("Invalid status value", 400));
  }

  // Get application
  const { data: application, error: fetchError } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .single();
  
  if (fetchError || !application) {
    return next(new ErrorHandler("Application not found!", 404));
  }

  // Verify that the employer owns this application
  if (application.employer_id !== req.user.id) {
    return next(new ErrorHandler("Unauthorized to update this application", 403));
  }

  // Update status
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', id);

  if (updateError) {
    return next(new ErrorHandler(updateError.message, 500));
  }

  res.status(200).json({
    success: true,
    message: `Application ${status}!`,
  });
});
