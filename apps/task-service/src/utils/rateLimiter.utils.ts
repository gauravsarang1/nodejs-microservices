import { createRateLimiter } from "shared";

// Rate limiter middleware to limit requests per IP address

// Create task rate limiter
export const createTaskRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  message:
    "Too many task creation attempts from this IP, please try again after 15 minutes.",
});

// List tasks rate limiter
export const listTasksRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message:
    "Too many task listing requests from this IP, please try again after 15 minutes.",
});

// Get single task rate limiter
export const getSingleTaskRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message:
    "Too many task retrieval requests from this IP, please try again after 15 minutes.",
});

// Delete task rate limiter
export const deleteTaskRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message:
    "Too many task deletion attempts from this IP, please try again after 15 minutes.",
});