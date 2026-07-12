export const ARCHITECTURE_CONFIG_SCHEMA = deepFreeze({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/sumanpu853-star/Nexus/schemas/nexus.config.schema.json",
  title: "Nexus Configuration",
  type: "object",
  additionalProperties: false,
  required: ["architecture"],
  properties: {
    architecture: {
      type: "object",
      additionalProperties: false,
      required: ["checks"],
      properties: {
        checks: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "title", "target", "kind", "severity", "guidance"],
            properties: {
              id: nonEmptyString("Stable machine-readable check identifier."),
              title: nonEmptyString("Human-readable check title."),
              target: nonEmptyString("Repository-relative path to inspect."),
              kind: {
                type: "string",
                enum: ["fileExists", "directoryExists", "contentIncludes", "forbiddenImports"]
              },
              severity: {
                type: "string",
                enum: ["required", "recommended"]
              },
              expected: {
                type: "array",
                minItems: 1,
                items: nonEmptyString("Text expected in the target file.")
              },
              forbidden: {
                type: "array",
                minItems: 1,
                items: nonEmptyString("Import specifier prefix that must not be used.")
              },
              guidance: nonEmptyString("Actionable guidance when the check fails.")
            },
            allOf: [
              {
                if: {
                  properties: {
                    kind: { const: "contentIncludes" }
                  },
                  required: ["kind"]
                },
                then: {
                  required: ["expected"]
                }
              },
              {
                if: {
                  properties: {
                    kind: { const: "forbiddenImports" }
                  },
                  required: ["kind"]
                },
                then: {
                  required: ["forbidden"]
                }
              }
            ]
          }
        }
      }
    }
  }
});

export function getArchitectureConfigSchema() {
  return ARCHITECTURE_CONFIG_SCHEMA;
}

function nonEmptyString(description) {
  return {
    type: "string",
    minLength: 1,
    description
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return value;
}
