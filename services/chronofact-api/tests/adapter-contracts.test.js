import assert from "node:assert/strict";
import test from "node:test";
import { assertChronofactAdapters } from "../src/adapters/contracts.js";

test("adapter contracts reject missing service methods at construction time", () => {
  assert.throws(
    () =>
      assertChronofactAdapters({
        limora: { resolveIdentity() {}, requirePermission() {} },
        dualweave: { storeUpload() {} },
        chronestia: { registerVersion() {} },
        ai: { explain() {} }
      }),
    /chronestia adapter must implement verifyVersion/
  );
});
