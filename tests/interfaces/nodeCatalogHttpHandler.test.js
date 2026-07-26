import assert from "node:assert/strict";
import test from "node:test";
import { createNodeCatalogService } from "../../src/application/nodeCatalogService.js";
import { createNodeCatalogHttpHandler } from "../../src/interfaces/nodeCatalogHttpHandler.js";

test("node catalog http handler responds to GET /nodes", async () => {
  const handler = createNodeCatalogHttpHandler({
    nodeCatalogService: createNodeCatalogService()
  });

  const response = await handler.handle({
    method: "GET",
    path: "/nodes"
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(
    response.body.nodes.some((definition) => definition.type === "http_request"),
    true
  );
  assert.equal(Object.isFrozen(response.body.nodes[0]), true);
});

test("node catalog http handler returns json 404 responses", async () => {
  const handler = createNodeCatalogHttpHandler({
    nodeCatalogService: createNodeCatalogService()
  });

  const response = await handler.handle({
    method: "POST",
    path: "/nodes"
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, "not_found");
});
