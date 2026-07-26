import assert from "node:assert/strict";
import test from "node:test";
import { createSandboxedRunnerService } from "../../src/application/sandboxedRunnerService.js";

test("sandboxed runner service runs python_script only through a sandboxed runner", async () => {
  const service = createSandboxedRunnerService({
    runners: [
      {
        node_type: "python_script",
        sandboxed: true,
        async run({ node, input }) {
          return {
            code: node.parameters.code,
            input
          };
        }
      }
    ]
  });

  assert.deepEqual(service.getRunnerCapabilities(), {
    python_script: { sandboxed: true }
  });
  assert.deepEqual(
    await service.runNode({
      node: {
        id: "script",
        type: "python_script",
        parameters: { code: "return input" }
      },
      input: { value: 42 }
    }),
    {
      node_id: "script",
      node_type: "python_script",
      output: {
        code: "return input",
        input: { value: 42 }
      }
    }
  );
});

test("sandboxed runner service blocks unsafe nodes without a configured sandbox", async () => {
  const service = createSandboxedRunnerService();

  await assert.rejects(
    () =>
      service.runNode({
        node: {
          id: "script",
          type: "python_script"
        }
      }),
    (error) => {
      assert.equal(error.name, "UnsafeExecutionError");
      return true;
    }
  );
});

test("sandboxed runner service rejects unsandboxed runner registrations", () => {
  assert.throws(
    () =>
      createSandboxedRunnerService({
        runners: [
          {
            node_type: "python_script",
            sandboxed: false,
            async run() {
              return {};
            }
          }
        ]
      }),
    /sandboxed: true/
  );
});
