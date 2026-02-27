import { supabase } from "../database/supabaseClient.js";
import { catchAsyncErrors } from "./catchAsyncError.js";
import ErrorHandler from "./error.js";
import { verifyJWTToken } from "../utils/tokenUtils.js";

export const isAuthenticated = catchAsyncErrors(async (req, res, next) => {
  const { token } = req.cookies;
  
  if (!token) {
    return next(new ErrorHandler("User Not Authorized", 401));
  }

  try {
    const decoded = verifyJWTToken(token);

    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, favourite_sport, created_at')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return next(new ErrorHandler("User Not Found", 404));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorHandler("Invalid or Expired Token", 401));
  }
});
