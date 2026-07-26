import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryAgentRepositories
} from "../../src/infrastructure/inMemoryAgentRepositories.js";

test("in-memory agent repositories save and clone records", async () => {
  const repositories = createInMemoryAgentRepositories();
  const agent = {
    id: "agent_1",
    project_id: "project_1",
    name: "Support Agent"
  };

  const saved = await repositories.agents.save(agent);
  saved.name = "Changed";
  await repositories.promptVersions.save({
    id: "prompt_1",
    agent_id: "agent_1",
    version: 1
  });
  await repositories.agentRuns.save({
    id: "run_1",
    agent_id: "agent_1",
    status: "completed"
  });
  await repositories.agentMemories.save({
    id: "memory_1",
    project_id: "project_1",
    agent_id: "agent_1",
    scope: "session",
    key: "session:default"
  });

  assert.equal((await repositories.agents.findByProjectId("project_1"))[0].name, "Support Agent");
  assert.equal((await repositories.promptVersions.findByAgentId("agent_1"))[0].version, 1);
  assert.equal((await repositories.agentRuns.findByAgentId("agent_1"))[0].id, "run_1");
  assert.equal(
    (
      await repositories.agentMemories.findByIdentity({
        project_id: "project_1",
        agent_id: "agent_1",
        scope: "session",
        key: "session:default"
      })
    ).id,
    "memory_1"
  );
});

test("in-memory agent repositories update project indexes", async () => {
  const repositories = createInMemoryAgentRepositories();

  await repositories.agents.save({
    id: "agent_1",
    project_id: "project_1",
    name: "Support Agent"
  });
  await repositories.agents.save({
    id: "agent_1",
    project_id: "project_2",
    name: "Moved Agent"
  });

  assert.deepEqual(await repositories.agents.findByProjectId("project_1"), []);
  assert.equal((await repositories.agents.findByProjectId("project_2"))[0].name, "Moved Agent");
});
