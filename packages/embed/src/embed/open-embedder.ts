import { env, InferenceSession, Tensor } from "onnxruntime-node";
import { left, right, wrap } from "@zambil/core/either";
import { parseVocabulary, tokenize } from "../tokenize/word-piece.ts";
import type { Either } from "@zambil/core/either";
import type { EmbeddingModel } from "../model/embedding-model.ts";
import { fetchModel } from "../model/fetch-model.ts";
import type { FetchModelOptions } from "../model/fetch-model.ts";
import { poolVectors } from "./pool-vectors.ts";
import { readFileSync } from "node:fs";
import type { WordPieceVocabulary } from "../tokenize/word-piece.ts";

/** A query is what the user asks. A document is a note description. Some models embed them differently. */
export type TextRole = "query" | "document";

/** Whether the texts are queries or documents. */
export interface EmbedOptions {
  role: TextRole;
}

/** A loaded model. `modelKey` names the model and its revision, so that an index made by another model is not reused. */
export interface Embedder {
  modelKey: string;
  embed: (texts: string[], options: EmbedOptions) => Promise<Either<string, Float32Array[]>>;
}

/**
 * How many texts go through the model at once. The 8-bit model scales its numbers over the whole
 * batch, so a text in a batch gets a slightly different vector than the same text alone. One text at
 * a time gives each description one vector, with or without an index.
 */
const batchSize = 1;

interface LoadedModel {
  model: EmbeddingModel;
  session: InferenceSession;
  vocabulary: WordPieceVocabulary;
}

interface BatchOptions {
  texts: string[];
}

interface TensorOptions {
  width: number;
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function readVocabularyFile(path: string): Either<string, string> {
  try {
    return right(readFileSync(path, "utf8"));
  } catch (error: unknown) {
    return left(`cannot read ${path}: ${describe(error)}`);
  }
}

function int64Tensor(rows: number[][], options: TensorOptions): Tensor {
  const flatIds = new BigInt64Array(rows.length * options.width);
  for (const [row, ids] of rows.entries()) {
    for (const [column, id] of ids.entries()) flatIds[row * options.width + column] = BigInt(id);
  }
  return new Tensor("int64", flatIds, [rows.length, options.width]);
}

async function embedBatch(
  loaded: LoadedModel,
  options: BatchOptions,
): Promise<Either<string, Float32Array[]>> {
  const { model, session, vocabulary } = loaded;
  const ids: number[][] = [];
  for (const text of options.texts) {
    ids.push(tokenize(text, { vocabulary, maxTokens: model.maxTokens }));
  }
  const width = Math.max(...ids.map((row) => row.length));
  const mask = ids.map((row) => row.map(() => 1));
  const feeds: Record<string, Tensor> = {
    input_ids: int64Tensor(ids, { width }),
    attention_mask: int64Tensor(mask, { width }),
  };
  const segments = ids.map(() => [0]);
  if (session.inputNames.includes("token_type_ids")) {
    feeds.token_type_ids = int64Tensor(segments, { width });
  }
  const outputs = await wrap(session.run(feeds));
  if (!outputs.ok) {
    return left(`the model ${model.id} cannot embed the text: ${describe(outputs.error)}`);
  }
  const [outputName = ""] = session.outputNames;
  const output = outputs.value[outputName];
  if (!(output?.data instanceof Float32Array)) {
    return left(`the model ${model.id} has no float output ${outputName}`);
  }
  const [, tokens = 0, dimensions = 0] = output.dims;
  const hiddenStates = { data: output.data, batch: options.texts.length, tokens, dimensions };
  return right(poolVectors(hiddenStates, { mask, pooling: model.pooling }));
}

async function embedAll(
  loaded: LoadedModel,
  options: BatchOptions,
): Promise<Either<string, Float32Array[]>> {
  const vectors: Float32Array[] = [];
  for (let start = 0; start < options.texts.length; start += batchSize) {
    const texts = options.texts.slice(start, start + batchSize);
    const batch = await embedBatch(loaded, { texts });
    if (!batch.ok) return batch;
    vectors.push(...batch.value);
  }
  return right(vectors);
}

/**
 * Loads a model with ONNX Runtime, after `fetchModel` puts its files in the cache. Loading takes most
 * of the time of a search, so a caller loads it once and embeds many texts with it. ONNX Runtime logs
 * only errors, because on some machines it warns about hardware on every start.
 */
export async function openEmbedder(
  model: EmbeddingModel,
  options: FetchModelOptions,
): Promise<Either<string, Embedder>> {
  const paths = await fetchModel(model, options);
  if (!paths.ok) return paths;
  const vocabularyText = readVocabularyFile(paths.value.vocabulary);
  if (!vocabularyText.ok) return vocabularyText;
  const vocabulary = parseVocabulary(vocabularyText.value);
  if (!vocabulary.ok) return left(`${paths.value.vocabulary}: ${vocabulary.error}`);
  env.logLevel = "error";
  const session = await wrap(InferenceSession.create(paths.value.weights));
  if (!session.ok) return left(`cannot load ${paths.value.weights}: ${describe(session.error)}`);
  const loaded = { model, session: session.value, vocabulary: vocabulary.value };
  return right({
    modelKey: `${model.id}@${model.revision}`,
    embed: (texts, embedOptions) => {
      const prefix = embedOptions.role === "query" ? model.queryPrefix : model.documentPrefix;
      return embedAll(loaded, { texts: texts.map((text) => `${prefix}${text}`) });
    },
  });
}
