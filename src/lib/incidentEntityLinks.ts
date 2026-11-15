/** Merge data shards without allowing a later shard to hide an existing incident. */
export function mergeIncidentEntities(parts: Record<string, string[]>[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const part of parts) {
    for (const [id, entities] of Object.entries(part)) {
      if (Object.prototype.hasOwnProperty.call(result, id)) throw new Error(`Duplicate incident entity mapping: ${id}`);
      result[id] = entities;
    }
  }
  return result;
}
