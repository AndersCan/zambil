import type { EmbeddingModel } from "./embedding-model.ts";

/**
 * The model that search uses: all-MiniLM-L6-v2, quantized to 8 bits. `measurements.md` holds the
 * numbers that picked it, and `README.md` says why.
 */
export const searchModel: EmbeddingModel = {
  id: "all-minilm-l6-v2",
  repository: "Xenova/all-MiniLM-L6-v2",
  revision: "751bff37182d3f1213fa05d7196b954e230abad9",
  weights: {
    path: "onnx/model_quantized.onnx",
    bytes: 22_972_370,
    sha256: "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
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
 * The lowest score that counts as a match. It is 0.02 above the best score of a wrong note in every
 * prose case, because a false match costs more than a miss: the agent reads each match.
 */
export const minimumScore = 0.42;

/** The most notes that one search returns. */
export const matchLimit = 3;
