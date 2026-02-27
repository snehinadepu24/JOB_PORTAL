import { generateJWTToken } from './tokenUtils.js';

export const sendToken = (user, statusCode, res, message) => {
  const token = generateJWTToken(user.id);
  const options = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  // Remove password from user object before sending
  const { password, ...userWithoutPassword } = user;

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user: userWithoutPassword,
    message,
    token,
  });
};
