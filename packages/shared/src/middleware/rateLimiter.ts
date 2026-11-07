import rateLimit, {
  type Options,
} from "express-rate-limit";

interface RateLimiterConfig {
  windowMs: number;
  limit: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: Options["keyGenerator"];
}

export const createRateLimiter = ({
  windowMs,
  limit,
  message = "Too many requests. Please try again later.",
  skipSuccessfulRequests = false,
  skipFailedRequests = false,
  keyGenerator,
}: RateLimiterConfig) => {
  return rateLimit({
    windowMs,
    limit,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    skipSuccessfulRequests,
    skipFailedRequests,

    ...(keyGenerator && { keyGenerator }),

    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });
};