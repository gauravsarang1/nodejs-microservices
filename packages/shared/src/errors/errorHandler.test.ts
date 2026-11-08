import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest, type Server } from "node:http";
import test from "node:test";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import pino from "pino";
import { AppError } from "./AppError";
import { errorHandler } from "./errorHandler";
import { createHttpLogger } from "../logger/httpLogger";

function request(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, path, headers },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function startTestServer(
  configureApp: (app: Express) => void,
  logLines: string[],
): Promise<Server> {
  const app = express();
  const requestLogger = pino(
    { level: "trace" },
    {
      write(chunk: string) {
        logLines.push(chunk);
      },
    },
  );

  app.use(createHttpLogger(requestLogger));
  configureApp(app);
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("returns a safe generic response for unexpected errors", async () => {
  const logLines: string[] = [];
  const server = await startTestServer((app) => {
    app.get("/failure", (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new AppError(500, "Database operation failed", false, {
          code: "DATABASE_QUERY_FAILED",
          details: { databaseCode: "internal-only" },
        }),
      );
    });
  }, logLines);

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await request(address.port, "/failure");
    const body = JSON.parse(response.body) as {
      message: string;
      error: {
        code: string;
        message: string;
        requestId: string;
        details?: unknown;
      };
    };
    const requestId = response.headers["x-request-id"];

    assert.equal(response.statusCode, 500);
    assert.equal(body.error.requestId, requestId);
    assert.equal(body.message, "Internal server error");
    assert.equal(body.error.code, "INTERNAL_SERVER_ERROR");
    assert.equal(body.error.message, "Internal server error");
    assert.equal(body.error.details, undefined);
    assert.ok(logLines.some((line) => line.includes("internal-only")));
    assert.ok(logLines.some((line) => line.includes("durationMs")));
  } finally {
    await closeServer(server);
  }
});

test("exposes only explicitly public error details", async () => {
  const server = await startTestServer((app) => {
    app.get("/validation", (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new AppError(400, "Invalid request", true, {
          code: "VALIDATION_FAILED",
          details: { internal: "do-not-return" },
          publicDetails: { field: "email" },
        }),
      );
    });
  }, []);

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await request(address.port, "/validation");
    const body = JSON.parse(response.body) as {
      error: { details?: Record<string, unknown> };
    };

    assert.equal(response.statusCode, 400);
    assert.deepEqual(body.error.details, { field: "email" });
    assert.ok(!response.body.includes("do-not-return"));
  } finally {
    await closeServer(server);
  }
});

test("maps oversized JSON body errors to a client error", async () => {
  const server = await startTestServer((app) => {
    app.get("/body-too-large", (_req: Request, _res: Response, next: NextFunction) => {
      next(Object.assign(new Error("body parser limit exceeded"), {
        type: "entity.too.large",
      }));
    });
  }, []);

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await request(address.port, "/body-too-large");
    const body = JSON.parse(response.body) as { error: { code: string } };

    assert.equal(response.statusCode, 413);
    assert.equal(body.error.code, "REQUEST_BODY_TOO_LARGE");
  } finally {
    await closeServer(server);
  }
});

test("omits request headers and query strings from access logs", async () => {
  const logLines: string[] = [];
  const server = await startTestServer((app) => {
    app.get("/success", (_req, res) => res.end("ok"));
  }, logLines);

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await request(
      address.port,
      "/success?token=query-secret",
      {
        "x-request-id": "safe-request-id",
        "x-gateway-secret": "header-secret",
      },
    );
    const logs = logLines.join("");

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-request-id"], "safe-request-id");
    assert.ok(logs.includes('"requestId":"safe-request-id"'));
    assert.ok(!logs.includes("query-secret"));
    assert.ok(!logs.includes("header-secret"));
    assert.ok(!logs.includes("x-gateway-secret"));
  } finally {
    await closeServer(server);
  }
});
