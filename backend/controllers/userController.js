import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import { User } from "../models/userSchema.js";
import ErrorHandler from "../middlewares/error.js";
import { sendToken } from "../utils/jwtToken.js";

export const register = catchAsyncErrors(async (req, res, next) => {
  const { name, email, phone, password, role, favouriteSport } = req.body;
  if (!name || !email || !phone || !password || !role || !favouriteSport) {
    return next(new ErrorHandler("Please fill full form !"));
  }
  const isEmail = await User.findOne({ email });
  if (isEmail) {
    return next(new ErrorHandler("Email already registered !"));
  }
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role,
    favouriteSport,
  });
  sendToken(user, 201, res, "User Registered Sucessfully !");
});

export const login = catchAsyncErrors(async (req, res, next) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return next(new ErrorHandler("Please provide email ,password and role !"));
  }
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return next(new ErrorHandler("Invalid Email Or Password.", 400));
  }
  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid Email Or Password !", 400));
  }
  if (user.role !== role) {
    return next(
      new ErrorHandler(`User with provided email and ${role} not found !`, 404)
    );
  }
  sendToken(user, 201, res, "User Logged In Sucessfully !");
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
  
  const user = await User.findOne({ email }).select("+password");
  
  if (!user) {
    return next(new ErrorHandler("User not found with this email!", 404));
  }
  
  if (user.favouriteSport !== favouriteSport) {
    return next(new ErrorHandler("Incorrect favourite sport!", 400));
  }
  
  // If email and favourite sport match, allow password reset
  sendToken(user, 200, res, "Verification successful, you can reset your password!");
});

export const resetPassword = catchAsyncErrors(async (req, res, next) => {
  const { email, favouriteSport, newPassword } = req.body;
  
  if (!email || !favouriteSport || !newPassword) {
    return next(new ErrorHandler("Please provide all required fields!"));
  }
  
  const user = await User.findOne({ email }).select("+password");
  
  if (!user) {
    return next(new ErrorHandler("User not found with this email!", 404));
  }
  
  if (user.favouriteSport !== favouriteSport) {
    return next(new ErrorHandler("Incorrect favourite sport!", 400));
  }
  
  user.password = newPassword;
  await user.save();
  
  res.status(200).json({
    success: true,
    message: "Password reset successfully!",
  });
});