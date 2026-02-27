import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import { supabase } from "../database/supabaseClient.js";
import ErrorHandler from "../middlewares/error.js";
import { sendToken } from "../utils/jwtToken.js";
import { hashPassword, comparePassword } from "../utils/passwordUtils.js";
import validator from "validator";

export const register = catchAsyncErrors(async (req, res, next) => {
  const { name, email, phone, password, role, favouriteSport } = req.body;
  
  if (!name || !email || !phone || !password || !role || !favouriteSport) {
    return next(new ErrorHandler("Please fill full form !"));
  }

  // Validate email
  if (!validator.isEmail(email)) {
    return next(new ErrorHandler("Please provide a valid Email!"));
  }

  // Validate name length
  if (name.length < 3 || name.length > 30) {
    return next(new ErrorHandler("Name must be between 3 and 30 characters!"));
  }

  // Validate password length
  if (password.length < 8 || password.length > 32) {
    return next(new ErrorHandler("Password must be between 8 and 32 characters!"));
  }

  // Validate role
  if (!['Job Seeker', 'Employer'].includes(role)) {
    return next(new ErrorHandler("Invalid role!"));
  }

  // Check if email already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    return next(new ErrorHandler("Email already registered !"));
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const { data: user, error } = await supabase
    .from('users')
    .insert([
      {
        name,
        email,
        phone: parseInt(phone),
        password: hashedPassword,
        role,
        favourite_sport: favouriteSport,
      }
    ])
    .select()
    .single();

  if (error) {
    return next(new ErrorHandler(error.message, 500));
  }

  sendToken(user, 201, res, "User Registered Successfully !");
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, role } = req.body;
  
  if (!email || !password || !role) {
    return next(new ErrorHandler("Please provide email, password and role !"));
  }

  // Get user with password
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    return next(new ErrorHandler("Invalid Email Or Password.", 400));
  }

  // Compare password
  const isPasswordMatched = await comparePassword(password, user.password);
  
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid Email Or Password !", 400));
  }

  if (user.role !== role) {
    return next(
      new ErrorHandler(`User with provided email and ${role} not found !`, 404)
    );
  }

  sendToken(user, 201, res, "User Logged In Successfully !");
});

export const logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(201)
    .cookie("token", "", {
      httpOnly: true,
      expires: new Date(Date.now()),
    })
    .json({
      success: true,
      message: "Logged Out Successfully !",
    });
});

export const getUser = catchAsyncErrors((req, res, next) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    user,
  });
});

export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const { email, favouriteSport } = req.body;
  
  if (!email || !favouriteSport) {
    return next(new ErrorHandler("Please provide email and favourite sport!"));
  }
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error || !user) {
    return next(new ErrorHandler("User not found with this email!", 404));
  }
  
  if (user.favourite_sport !== favouriteSport) {
    return next(new ErrorHandler("Incorrect favourite sport!", 400));
  }
  
  sendToken(user, 200, res, "Verification successful, you can reset your password!");
});

export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { email, favouriteSport, newPassword } = req.body;
  
  if (!email || !favouriteSport || !newPassword) {
    return next(new ErrorHandler("Please provide all required fields!"));
  }

  // Validate password length
  if (newPassword.length < 8 || newPassword.length > 32) {
    return next(new ErrorHandler("Password must be between 8 and 32 characters!"));
  }
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error || !user) {
    return next(new ErrorHandler("User not found with this email!", 404));
  }
  
  if (user.favourite_sport !== favouriteSport) {
    return next(new ErrorHandler("Incorrect favourite sport!", 400));
  }
  
  // Hash new password
  const hashedPassword = await hashPassword(newPassword);
  
  // Update password
  const { error: updateError } = await supabase
    .from('users')
    .update({ password: hashedPassword })
    .eq('id', user.id);

  if (updateError) {
    return next(new ErrorHandler(updateError.message, 500));
  }
  
  res.status(200).json({
    success: true,
    message: "Password reset successfully!",
  });
});
