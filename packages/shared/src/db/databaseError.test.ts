import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../errors/AppError";
import { runDatabaseQuery } from "./databaseError";

test("classifies database connection errors without exposing driver messages", async () => {
  const cause = Object.assign(new Error("connection reset"), {
    code: "ECONNRESET",
  });

  await assert.rejects(
    runDatabaseQuery("find_by_id", "user", async () => {
      throw cause;
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "DATABASE_UNAVAILABLE");
      assert.equal(error.cause, cause);
      return true;
    },
  );
});

test("marks unexpected database failures as non-operational", async () => {
  await assert.rejects(
    runDatabaseQuery("find_by_id", "user", async () => {
      throw new Error("driver-specific details");
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 500);
      assert.equal(error.isOperational, false);
      assert.equal(error.code, "DATABASE_QUERY_FAILED");
      return true;
    },
  );
});
