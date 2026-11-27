import type { EmbeddingModel } from "./embedding-model.ts";

/**
 * The model that search uses: multi-qa-MiniLM-L6-cos-v1, quantized to 8 bits. It was trained to match
 * a short question to a passage. `measurements.md` holds the numbers that picked it, and `README.md`
 * says why.
 */
export const searchModel: EmbeddingModel = {
  id: "multi-qa-minilm-l6-cos-v1",
  repository: "Xenova/multi-qa-MiniLM-L6-cos-v1",
  revision: "3c96c1df3fec9a98a5de76e80877c8bec18498f6",
  weights: {
    path: "onnx/model_quantized.onnx",
    bytes: 22_972_369,
    sha256: "3da8d06414059630b9e6989c5877bae7d79c2dc5525070e2f36417c15bc07114",
  },
  vocabulary: {
    path: "vocab.txt",
    bytes: 231_508,
    sha256: "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3",
  },
  pooling: "mean",
  queryPrefix: "",
  documentPrefix: "",
  maxTokens: 256,
};

/**
 * The lowest score that counts as a match, for `zambil search` and for the agent hooks. It is the
 * highest threshold that still finds the for-loops note for "iterating", and it gives the fewest false
 * matches of the thresholds that find it.
 */
export const minimumScore = 0.38;

/** The most notes that one search returns. */
export const matchLimit = 3;
