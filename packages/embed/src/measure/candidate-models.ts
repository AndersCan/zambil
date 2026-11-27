import type { EmbeddingModel, ModelFile } from "../model/embedding-model.ts";
import { searchModel } from "../model/search-model.ts";

/** Every candidate uses the same lowercase BERT vocabulary, byte for byte. */
const bertVocabulary: ModelFile = {
  path: "vocab.txt",
  bytes: 231_508,
  sha256: "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3",
};

const searchPrompt = "Represent this sentence for searching relevant passages: ";

/** The small sentence embedders that `measure-embedders.ts` compares, the one that search uses first. Each is pinned to one commit. */
export const candidateModels: EmbeddingModel[] = [
  searchModel,
  {
    id: "all-minilm-l6-v2",
    repository: "Xenova/all-MiniLM-L6-v2",
    revision: "751bff37182d3f1213fa05d7196b954e230abad9",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 22_972_370,
      sha256: "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1",
    },
    vocabulary: bertVocabulary,
    pooling: "mean",
    queryPrefix: "",
    documentPrefix: "",
    maxTokens: 256,
  },
  {
    id: "all-minilm-l6-v2-fp32",
    repository: "Xenova/all-MiniLM-L6-v2",
    revision: "751bff37182d3f1213fa05d7196b954e230abad9",
    weights: {
      path: "onnx/model.onnx",
      bytes: 90_387_606,
      sha256: "759c3cd2b7fe7e93933ad23c4c9181b7396442a2ed746ec7c1d46192c469c46e",
    },
    vocabulary: bertVocabulary,
    pooling: "mean",
    queryPrefix: "",
    documentPrefix: "",
    maxTokens: 256,
  },
  {
    id: "paraphrase-minilm-l3-v2",
    repository: "Xenova/paraphrase-MiniLM-L3-v2",
    revision: "4b544e74dfc3256b2b56849ea5d7064fee1ac846",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 17_452_106,
      sha256: "b190f50dd46296b9895ae8f274c3455762d08610f8788f4a9bd15019f4f7160c",
    },
    vocabulary: bertVocabulary,
    pooling: "mean",
    queryPrefix: "",
    documentPrefix: "",
    maxTokens: 128,
  },
  {
    id: "bge-small-en-v1.5",
    repository: "Xenova/bge-small-en-v1.5",
    revision: "ea104dacec62c0de699686887e3f920caeb4f3e3",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 34_014_426,
      sha256: "6c9c6101a956d62dfb5e7190c538226c0c5bb9cb27b651234b6df063ee7dbfe4",
    },
    vocabulary: bertVocabulary,
    pooling: "first-token",
    queryPrefix: searchPrompt,
    documentPrefix: "",
    maxTokens: 512,
  },
  {
    id: "gte-small",
    repository: "Xenova/gte-small",
    revision: "5927d1727bb12db490052a1b33265ad78058de08",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 34_014_426,
      sha256: "18dec105109b6004369799ca4761fb8fb413c64172c02147bcfac186b5c5f6cb",
    },
    vocabulary: bertVocabulary,
    pooling: "mean",
    queryPrefix: "",
    documentPrefix: "",
    maxTokens: 512,
  },
  {
    id: "e5-small-v2",
    repository: "Xenova/e5-small-v2",
    revision: "02af79985278377e65c724a76275707cb0333c70",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 34_014_367,
      sha256: "7d9092cb25f2bd1c023b7e8d2aa459044a02030ac880e5a59fdaf27af69f1ded",
    },
    vocabulary: bertVocabulary,
    pooling: "mean",
    queryPrefix: "query: ",
    documentPrefix: "passage: ",
    maxTokens: 512,
  },
  {
    id: "mxbai-embed-xsmall-v1",
    repository: "mixedbread-ai/mxbai-embed-xsmall-v1",
    revision: "e6ac24e5d6efb8782b59de1647b3ececb4ece94e",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 24_448_010,
      sha256: "952f996d8cf46c311ee8654a750fa942b71c8b94aabe69d043dbb2bcaff5528e",
    },
    vocabulary: bertVocabulary,
    pooling: "mean",
    queryPrefix: "",
    documentPrefix: "",
    maxTokens: 256,
  },
  {
    id: "snowflake-arctic-embed-xs",
    repository: "Snowflake/snowflake-arctic-embed-xs",
    revision: "d8c86521100d3556476a063fc2342036d45c106f",
    weights: {
      path: "onnx/model_quantized.onnx",
      bytes: 22_972_992,
      sha256: "e6aa5e656466a73d7c3111e9a3378bd13e5b93af30eaac2b3f13fd56692589a1",
    },
    vocabulary: bertVocabulary,
    pooling: "first-token",
    queryPrefix: searchPrompt,
    documentPrefix: "",
    maxTokens: 512,
  },
];
