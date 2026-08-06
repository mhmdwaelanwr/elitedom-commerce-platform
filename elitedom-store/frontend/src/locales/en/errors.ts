export const errors = {
  unknown: "Something went wrong. Please try again.",
  network: "The service is unavailable. Check your connection and retry.",
  unauthorized: "Sign in to continue.",
  forbidden: "You do not have permission to perform this action.",
  notFound: "The requested item could not be found.",
  validation: "Review the highlighted fields and try again.",
  rateLimited: "Too many attempts. Please wait before trying again.",
  server: "The server could not complete the request.",
  paymentFailed: "The payment was not completed.",
  outOfStock: "One or more items are no longer available.",
} as const;
