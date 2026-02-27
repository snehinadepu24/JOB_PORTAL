export const catchAsyncErrors = (theFunction) => {
  return (req, res, next) => {
    Promise.resolve(theFunction(req, res, next)).catch(next);
  };
};

// Alias for compatibility
export const catchAsyncError = catchAsyncErrors;

// Default export for compatibility
export default catchAsyncErrors;
