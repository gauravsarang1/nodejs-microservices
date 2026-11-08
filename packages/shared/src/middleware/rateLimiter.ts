import rateLimit, {
  type Options,
} from "express-rate-limit";
import { errorResponse } from "../response/response";

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

    handler: (req, res) => {
      req.log.warn(
        {
          requestId: String(req.id),
          method: req.method,
          path: req.path,
          statusCode: 429,
          errorCode: "RATE_LIMIT_EXCEEDED",
        },
        "HTTP request rate limited",
      );

      errorResponse(
        res,
        {
          code: "RATE_LIMIT_EXCEEDED",
          message,
          requestId: req.id === undefined ? undefined : String(req.id),
        },
        429,
      );
    },
  });
};