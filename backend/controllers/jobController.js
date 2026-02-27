import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import { supabase } from "../database/supabaseClient.js";
import ErrorHandler from "../middlewares/error.js";

export const getAllJobs = catchAsyncErrors(async (req, res, next) => {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('expired', false)
    .order('job_posted_on', { ascending: false });

  if (error) {
    return next(new ErrorHandler(error.message, 500));
  }

  res.status(200).json({
    success: true,
    jobs,
  });
});

export const postJob = catchAsyncErrors(async (req, res, next) => {
  const { role } = req.user;

  if (role === "Job Seeker") {
    return next(
      new ErrorHandler("Job Seeker not allowed to access this resource.", 400)
    );
  }

  const {
    title,
    description,
    category,
    country,
    city,
    location,
    fixedSalary,
    salaryFrom,
    salaryTo,
  } = req.body;

  if (!title || !description || !category || !country || !city || !location) {
    return next(new ErrorHandler("Please provide full job details.", 400));
  }

  if (location.length < 3) {
    return next(new ErrorHandler("Location must contain at least 3 characters.", 400));
  }

  if ((!salaryFrom || !salaryTo) && !fixedSalary) {
    return next(
      new ErrorHandler(
        "Please either provide fixed salary or ranged salary.",
        400
      )
    );
  }

  if (salaryFrom && salaryTo && fixedSalary) {
    return next(
      new ErrorHandler("Cannot Enter Fixed and Ranged Salary together.", 400)
    );
  }

  const postedBy = req.user.id;

  const { data: job, error } = await supabase
    .from('jobs')
    .insert([
      {
        title,
        description,
        category,
        country,
        city,
        location,
        fixed_salary: fixedSalary ? parseInt(fixedSalary) : null,
        salary_from: salaryFrom ? parseInt(salaryFrom) : null,
        salary_to: salaryTo ? parseInt(salaryTo) : null,
        posted_by: postedBy,
      }
    ])
    .select()
    .single();

  if (error) {
    return next(new ErrorHandler(error.message, 500));
  }

  res.status(200).json({
    success: true,
    message: "Job Posted Successfully!",
    job,
  });
});

export const getMyJobs = catchAsyncErrors(async (req, res, next) => {
  const { role } = req.user;

  if (role === "Job Seeker") {
    return next(
      new ErrorHandler("Job Seeker not allowed to access this resource.", 400)
    );
  }

  const { data: myJobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('posted_by', req.user.id)
    .order('job_posted_on', { ascending: false });

  if (error) {
    return next(new ErrorHandler(error.message, 500));
  }

  res.status(200).json({
    success: true,
    myJobs,
  });
});

export const updateJob = catchAsyncErrors(async (req, res, next) => {
  const { role } = req.user;

  if (role === "Job Seeker") {
    return next(
      new ErrorHandler("Job Seeker not allowed to access this resource.", 400)
    );
  }

  const { id } = req.params;

  // Check if job exists
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    return next(new ErrorHandler("OOPS! Job not found.", 404));
  }

  // Verify ownership
  if (job.posted_by !== req.user.id) {
    return next(new ErrorHandler("Not authorized to update this job.", 403));
  }

  // Prepare update data
  const updateData = {};
  if (req.body.title) updateData.title = req.body.title;
  if (req.body.description) updateData.description = req.body.description;
  if (req.body.category) updateData.category = req.body.category;
  if (req.body.country) updateData.country = req.body.country;
  if (req.body.city) updateData.city = req.body.city;
  if (req.body.location) updateData.location = req.body.location;
  if (req.body.fixedSalary !== undefined) updateData.fixed_salary = req.body.fixedSalary ? parseInt(req.body.fixedSalary) : null;
  if (req.body.salaryFrom !== undefined) updateData.salary_from = req.body.salaryFrom ? parseInt(req.body.salaryFrom) : null;
  if (req.body.salaryTo !== undefined) updateData.salary_to = req.body.salaryTo ? parseInt(req.body.salaryTo) : null;
  if (req.body.expired !== undefined) updateData.expired = req.body.expired;

  const { error: updateError } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    return next(new ErrorHandler(updateError.message, 500));
  }

  res.status(200).json({
    success: true,
    message: "Job Updated!",
  });
});

export const deleteJob = catchAsyncErrors(async (req, res, next) => {
  const { role } = req.user;

  if (role === "Job Seeker") {
    return next(
      new ErrorHandler("Job Seeker not allowed to access this resource.", 400)
    );
  }

  const { id } = req.params;

  // Check if job exists
  const { data: job, error: fetchError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !job) {
    return next(new ErrorHandler("OOPS! Job not found.", 404));
  }

  // Verify ownership
  if (job.posted_by !== req.user.id) {
    return next(new ErrorHandler("Not authorized to delete this job.", 403));
  }

  const { error: deleteError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return next(new ErrorHandler(deleteError.message, 500));
  }

  res.status(200).json({
    success: true,
    message: "Job Deleted!",
  });
});

export const getSingleJob = catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !job) {
    return next(new ErrorHandler("Job not found.", 404));
  }

  res.status(200).json({
    success: true,
    job,
  });
});
