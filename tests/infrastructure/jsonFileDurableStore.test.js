import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createJsonFileDurableStore
} from "../../src/infrastructure/jsonFileDurableStore.js";

test("json file durable store persists records across store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexus-store-"));
  const filePath = join(directory, "runtime.json");

  try {
    const firstStore = createJsonFileDurableStore({ filePath });

    await firstStore.put("queue_jobs", {
      id: "queue_job_1",
      status: "queued"
    });

    const secondStore = createJsonFileDurableStore({ filePath });
    const found = await secondStore.get("queue_jobs", "queue_job_1");
    const listed = await secondStore.list("queue_jobs");

    found.status = "mutated";

    assert.equal(found.status, "mutated");
    assert.equal((await secondStore.get("queue_jobs", "queue_job_1")).status, "queued");
    assert.deepEqual(listed, [
      {
        id: "queue_job_1",
        status: "queued"
      }
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("json file durable store deletes records and validates collection names", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexus-store-"));
  const filePath = join(directory, "runtime.json");

  try {
    const store = createJsonFileDurableStore({ filePath });

    await store.put("queue_jobs", {
      id: "queue_job_1",
      status: "queued"
    });

    assert.equal(await store.delete("queue_jobs", "queue_job_1"), true);
    assert.equal(await store.get("queue_jobs", "queue_job_1"), null);
    await assert.rejects(
      () => store.list("QueueJobs"),
      /lowercase/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
