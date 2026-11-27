/** One file of a model, pinned by its size and SHA-256 so that a download is verified. */
export interface ModelFile {
  path: string;
  bytes: number;
  sha256: string;
}

/** How one vector is read from the vectors of the tokens: their mean, or the first token. */
export type Pooling = "mean" | "first-token";

/**
 * A sentence embedder with a BERT WordPiece vocabulary, pinned to one Hugging Face commit. Some models
 * expect a prefix before a query or a document, for example `"query: "`.
 */
export interface EmbeddingModel {
  id: string;
  repository: string;
  revision: string;
  weights: ModelFile;
  vocabulary: ModelFile;
  pooling: Pooling;
  queryPrefix: string;
  documentPrefix: string;
  maxTokens: number;
}

/** The model and its revision, so that an index made by another model is not reused. */
export function modelKeyOf(model: EmbeddingModel): string {
  return `${model.id}@${model.revision}`;
}
