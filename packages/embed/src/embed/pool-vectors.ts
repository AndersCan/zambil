import { isNever } from "@zambil/core/is-never";
import type { Pooling } from "../model/embedding-model.ts";

/** The model output for a batch: one vector per token, `[batch, tokens, dimensions]` in one flat array. */
export interface TokenVectors {
  data: Float32Array;
  batch: number;
  tokens: number;
  dimensions: number;
}

/** The attention mask of the batch, and how one vector is read from the vectors of the tokens. */
export interface PoolOptions {
  mask: number[][];
  pooling: Pooling;
}

function normalizeLength(vector: Float32Array): Float32Array {
  let sum = 0;
  for (const component of vector) sum += component * component;
  const length = Math.sqrt(sum);
  if (length === 0) return vector;
  for (const [position, component] of vector.entries()) vector[position] = component / length;
  return vector;
}

interface TextOptions {
  text: number;
  mask: number[];
}

function meanOfTokens(output: TokenVectors, options: TextOptions): Float32Array {
  const { dimensions, tokens } = output;
  const vector = new Float32Array(dimensions);
  let counted = 0;
  for (const [token, attends] of options.mask.entries()) {
    if (attends === 0) continue;
    counted += 1;
    const offset = (options.text * tokens + token) * dimensions;
    for (let dimension = 0; dimension < dimensions; dimension += 1) {
      vector[dimension] = (vector[dimension] ?? 0) + (output.data[offset + dimension] ?? 0);
    }
  }
  for (const [dimension, total] of vector.entries()) {
    vector[dimension] = total / Math.max(counted, 1);
  }
  return vector;
}

function firstToken(output: TokenVectors, options: TextOptions): Float32Array {
  const offset = options.text * output.tokens * output.dimensions;
  return output.data.slice(offset, offset + output.dimensions);
}

/** One unit-length vector per text, so that the dot product of two vectors is their cosine similarity. */
export function poolVectors(output: TokenVectors, options: PoolOptions): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (const [text, mask] of options.mask.entries()) {
    switch (options.pooling) {
      case "mean":
        vectors.push(normalizeLength(meanOfTokens(output, { text, mask })));
        break;
      case "first-token":
        vectors.push(normalizeLength(firstToken(output, { text, mask })));
        break;
      default:
        return isNever(options.pooling);
    }
  }
  return vectors;
}
