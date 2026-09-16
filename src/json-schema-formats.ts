import type { Ajv2020 } from "ajv/dist/2020.js";

const rfc3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const uuid =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

export function addContractFormats(ajv: Ajv2020): void {
  ajv.addFormat("date-time", {
    type: "string",
    validate: (value: string) =>
      rfc3339.test(value) && !Number.isNaN(Date.parse(value)),
  });
  ajv.addFormat("uri", {
    type: "string",
    validate: (value: string) => {
      try {
        const parsed = new URL(value);
        return Boolean(parsed.protocol);
      } catch {
        return false;
      }
    },
  });
  ajv.addFormat("uuid", {
    type: "string",
    validate: (value: string) => uuid.test(value),
  });
}
