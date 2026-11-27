#!/usr/bin/env node
import { enableCompileCache } from "node:module";

/**
 * Loads one candidate model in a new process and embeds one query, the work a search does before it
 * can score notes. Prints the times in milliseconds as JSON. `measure-embedders.ts` runs it with the model id and the
 * zambil cache folder as arguments.
 */
async function main(): Promise<void> {
  enableCompileCache();
  const started = performance.now();
  const { openEmbedder } = await import("../embed/open-embedder.ts");
  const { candidateModels } = await import("./candidate-models.ts");
  const imported = performance.now();
  const [, , modelId = "", folder = ""] = process.argv;
  const model = candidateModels.find((candidate) => candidate.id === modelId);
  if (model === undefined) throw new Error(`no candidate model is named ${modelId}`);
  const embedder = await openEmbedder(model, { cacheFolder: folder, report: () => {} });
  if (!embedder.ok) throw new Error(embedder.error);
  const loaded = performance.now();
  const query = await embedder.value.embed(["how do I loop over an array"], { role: "query" });
  if (!query.ok) throw new Error(query.error);
  const embedded = performance.now();
  const times = {
    processStart: started,
    importCode: imported - started,
    loadModel: loaded - imported,
    embedQuery: embedded - loaded,
    total: embedded,
  };
  process.stdout.write(`${JSON.stringify(times)}\n`);
}

await main();
