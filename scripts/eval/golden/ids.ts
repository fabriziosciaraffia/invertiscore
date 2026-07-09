// UUIDs fijos de los seeds BE-* (los GS-* llevan su uuid en seeds.ts).
// Compartido por seed-db.ts (upsert) y recompute.ts (§1 load).
export const BE_UUID: Record<string, string> = {
  "BE-caprate": "90111111-0000-4000-b000-000000000001",
  "BE-patrimonio": "90111111-0000-4000-b000-000000000002",
  "BE-sensibilidad": "90111111-0000-4000-b000-000000000003",
};
