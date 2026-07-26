import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryIntegrationRepositories
} from "../../src/infrastructure/inMemoryIntegrationRepositories.js";

test("in-memory integration repositories save and clone records", async () => {
  const repositories = createInMemoryIntegrationRepositories();
  const connection = {
    id: "connection_1",
    project_id: "project_1",
    integration_type: "slack",
    name: "Ops Slack"
  };

  const saved = await repositories.connections.save(connection);
  saved.name = "Changed";
  await repositories.invocations.save({
    id: "invocation_1",
    connection_id: "connection_1",
    status: "success"
  });
  await repositories.webhooks.save({
    id: "webhook_1",
    project_id: "project_1",
    path: "/hooks/intake"
  });
  await repositories.schedules.save({
    id: "schedule_1",
    project_id: "project_1",
    cron: "*/5 * * * *"
  });

  assert.equal(
    (await repositories.connections.findByProjectId("project_1"))[0].name,
    "Ops Slack"
  );
  assert.equal(
    (await repositories.invocations.findByConnectionId("connection_1"))[0].id,
    "invocation_1"
  );
  assert.equal((await repositories.webhooks.findByProjectId("project_1"))[0].path, "/hooks/intake");
  assert.equal((await repositories.schedules.findByProjectId("project_1"))[0].id, "schedule_1");
});

test("in-memory integration repositories update connection project indexes", async () => {
  const repositories = createInMemoryIntegrationRepositories();

  await repositories.connections.save({
    id: "connection_1",
    project_id: "project_1",
    integration_type: "slack",
    name: "Ops Slack"
  });
  await repositories.connections.save({
    id: "connection_1",
    project_id: "project_2",
    integration_type: "slack",
    name: "Moved Slack"
  });

  assert.deepEqual(await repositories.connections.findByProjectId("project_1"), []);
  assert.equal(
    (await repositories.connections.findByProjectId("project_2"))[0].name,
    "Moved Slack"
  );
});
