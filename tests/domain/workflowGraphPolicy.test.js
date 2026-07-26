import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWorkflowGraphValid,
  findWorkflowGraphViolations,
  topologicallySortWorkflowNodes
} from "../../src/domain/workflowGraphPolicy.js";

test("workflow graph policy accepts branching and joining DAGs", () => {
  const nodes = [
    { id: "trigger", type: "manual" },
    { id: "enrich", type: "http_request" },
    { id: "classify", type: "agent" },
    { id: "notify", type: "slack" }
  ];
  const edges = [
    { id: "edge_1", source: "trigger", target: "enrich" },
    { id: "edge_2", source: "trigger", target: "classify" },
    { id: "edge_3", source: "enrich", target: "notify" },
    { id: "edge_4", source: "classify", target: "notify" }
  ];

  assert.deepEqual(findWorkflowGraphViolations({ nodes, edges }), []);
  assert.doesNotThrow(() => assertWorkflowGraphValid({ nodes, edges }));
  assert.deepEqual(topologicallySortWorkflowNodes({ nodes, edges }), [
    "trigger",
    "enrich",
    "classify",
    "notify"
  ]);
});

test("workflow graph policy reports invalid node and edge shapes", () => {
  assert.deepEqual(
    findWorkflowGraphViolations({
      nodes: [{ id: "", type: "" }, null],
      edges: [{ id: "bad_edge", source: "", target: "" }, "not-an-edge"]
    }),
    [
      {
        type: "missing_node_id",
        node_index: 0,
        message: "Workflow node at index 0 must define a non-empty id."
      },
      {
        type: "missing_node_type",
        node_index: 0,
        node_id: null,
        message: "Workflow node at index 0 must define a non-empty type."
      },
      {
        type: "invalid_node",
        node_index: 1,
        message: "Workflow node at index 1 must be an object."
      },
      {
        type: "missing_edge_source",
        edge_id: "bad_edge",
        edge_index: 0,
        message: 'Workflow edge "bad_edge" must define a non-empty source.'
      },
      {
        type: "missing_edge_target",
        edge_id: "bad_edge",
        edge_index: 0,
        message: 'Workflow edge "bad_edge" must define a non-empty target.'
      },
      {
        type: "invalid_edge",
        edge_index: 1,
        message: "Workflow edge at index 1 must be an object."
      }
    ]
  );
});

test("workflow graph policy rejects duplicate node ids and missing edge endpoints", () => {
  const violations = findWorkflowGraphViolations({
    nodes: [
      { id: "trigger", type: "manual" },
      { id: "trigger", type: "http_request" }
    ],
    edges: [
      { id: "missing_source", source: "missing", target: "trigger" },
      { id: "missing_target", source: "trigger", target: "missing" }
    ]
  });

  assert.deepEqual(violations, [
    {
      type: "duplicate_node_id",
      node_id: "trigger",
      message: 'Node id "trigger" is duplicated.'
    },
    {
      type: "missing_edge_source",
      edge_id: "missing_source",
      source: "missing",
      message: 'Edge "missing_source" references missing source node "missing".'
    },
    {
      type: "missing_edge_target",
      edge_id: "missing_target",
      target: "missing",
      message: 'Edge "missing_target" references missing target node "missing".'
    }
  ]);
});

test("workflow graph policy rejects self edges and cycles", () => {
  assert.deepEqual(
    findWorkflowGraphViolations({
      nodes: [{ id: "trigger", type: "manual" }],
      edges: [{ id: "self", source: "trigger", target: "trigger" }]
    }),
    [
      {
        type: "self_edge",
        edge_id: "self",
        source: "trigger",
        target: "trigger",
        message: 'Edge "self" cannot connect node "trigger" to itself.'
      }
    ]
  );

  assert.throws(
    () =>
      assertWorkflowGraphValid({
        nodes: [
          { id: "a", type: "manual" },
          { id: "b", type: "http_request" },
          { id: "c", type: "slack" }
        ],
        edges: [
          { id: "a_to_b", source: "a", target: "b" },
          { id: "b_to_c", source: "b", target: "c" },
          { id: "c_to_a", source: "c", target: "a" }
        ]
      }),
    (error) => {
      assert.equal(error.name, "WorkflowGraphValidationError");
      assert.equal(error.code, "workflow_graph_invalid");
      assert.deepEqual(error.violations, [
        {
          type: "cycle",
          node_ids: ["a", "b", "c"],
          message: "Workflow graph contains a cycle involving: a, b, c."
        }
      ]);
      return true;
    }
  );
});
