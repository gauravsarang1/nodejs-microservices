import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function getRequestId(value: unknown): string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value)
    ? value
    : randomUUID();
}

export function createHttpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const requestId = getRequestId(req.headers["x-request-id"]);
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
    serializers: {
      req(req: {
        id?: string | number | object;
        method?: string;
        url?: string;
        remoteAddress?: string;
      }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0] || "/",
          remoteAddress: req.remoteAddress,
        };
      },
    },
    customProps: (req) => ({
      requestId: String(req.id),
    }),
    customLogLevel(_req, res) {
      if (res.statusCode >= 400) {
        return "silent";
      }

      return "info";
    },
  });
}
