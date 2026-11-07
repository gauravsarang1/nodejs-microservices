import { createRateLimiter } from "shared";

//rate limiter middleware to limit the number of requests per IP address
//register rate limiter
export const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // limit each IP to 5 requests per windowMs
  message:
    "Too many registration attempts from this IP, please try again after 15 minutes.",
});

//login rate limiter
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // limit each IP to 10 requests per windowMs
  message:
    "Too many login attempts from this IP, please try again after 15 minutes.",
});

//me rate limiter
export const meRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // limit each IP to 20 requests per windowMs
  message:
    "Too many requests from this IP, please try again after 15 minutes.",
});