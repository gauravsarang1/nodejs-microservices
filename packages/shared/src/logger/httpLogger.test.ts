import assert from "node:assert/strict";
import test from "node:test";
import { getRequestId } from "./httpLogger";

test("accepts bounded request IDs containing only safe characters", () => {
  assert.equal(getRequestId("client-id:123"), "client-id:123");
});

test("replaces malformed and oversized request IDs", () => {
  assert.match(getRequestId("bad id"), /^[0-9a-f-]{36}$/);
  assert.match(getRequestId("a".repeat(129)), /^[0-9a-f-]{36}$/);
});
