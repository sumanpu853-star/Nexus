import assert from "node:assert/strict";
import test from "node:test";
import {
  ARCHITECTURE_CONFIG_SCHEMA,
  getArchitectureConfigSchema
} from "../../src/domain/architectureConfigSchema.js";

test("getArchitectureConfigSchema returns the frozen Nexus config schema", () => {
  const schema = getArchitectureConfigSchema();

  assert.equal(schema, ARCHITECTURE_CONFIG_SCHEMA);
  assert.equal(Object.isFrozen(schema), true);
  assert.equal(Object.isFrozen(schema.properties.architecture), true);
  assert.equal(schema.required.includes("architecture"), true);
});

test("architecture config schema describes supported check kinds", () => {
  const kindSchema =
    ARCHITECTURE_CONFIG_SCHEMA.properties.architecture.properties.checks.items.properties.kind;

  assert.deepEqual(kindSchema.enum, [
    "fileExists",
    "directoryExists",
    "contentIncludes",
    "forbiddenImports"
  ]);
});

test("architecture config schema requires forbidden entries for forbidden import checks", () => {
  const checkSchema = ARCHITECTURE_CONFIG_SCHEMA.properties.architecture.properties.checks.items;

  assert.equal(checkSchema.properties.forbidden.type, "array");
  assert.equal(
    checkSchema.allOf.some(
      (condition) =>
        condition.if?.properties?.kind?.const === "forbiddenImports" &&
        condition.then?.required?.includes("forbidden")
    ),
    true
  );
});
