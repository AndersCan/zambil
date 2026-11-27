import { basename, dirname, join } from "node:path";
import type { EmbeddingModel, ModelFile } from "./embedding-model.ts";
import { left, right, wrap } from "@zambil/core/either";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Either } from "@zambil/core/either";
import { statSync } from "node:fs";

/** The local paths of a model's files, after they are in the cache and verified. */
export interface ModelPaths {
  weights: string;
  vocabulary: string;
}

/** The zambil cache folder, and where to tell the user that a download starts. */
export interface FetchModelOptions {
  cacheFolder: string;
  report: (message: string) => void;
}

function sizeOf(path: string): number | undefined {
  return statSync(path, { throwIfNoEntry: false })?.size;
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** One file of a model, and the zambil cache folder. */
export interface ModelFileOptions {
  file: ModelFile;
  cacheFolder: string;
}

/** Where a model file lives in the cache. The revision is part of the path, so a new pin never reuses an old file. */
export function modelFilePath(model: EmbeddingModel, options: ModelFileOptions): string {
  const { file, cacheFolder } = options;
  return join(cacheFolder, "models", model.id, model.revision, basename(file.path));
}

interface DownloadOptions {
  file: ModelFile;
  target: string;
}

async function download(
  model: EmbeddingModel,
  options: DownloadOptions,
): Promise<Either<string, string>> {
  const { file, target } = options;
  const url = `https://huggingface.co/${model.repository}/resolve/${model.revision}/${file.path}`;
  const response = await wrap(fetch(url));
  if (!response.ok) return left(`cannot download ${url}: ${describe(response.error)}`);
  if (!response.value.ok) return left(`cannot download ${url}: HTTP ${response.value.status}`);
  const body = await wrap(response.value.arrayBuffer());
  if (!body.ok) return left(`cannot download ${url}: ${describe(body.error)}`);
  const bytes = new Uint8Array(body.value);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const matches = bytes.byteLength === file.bytes && sha256 === file.sha256;
  if (!matches) {
    return left(
      `${url} has ${bytes.byteLength} bytes with SHA-256 ${sha256}, not ${file.bytes} bytes with ${file.sha256}`,
    );
  }
  const partial = `${target}.${process.pid}.partial`;
  const written = await wrap(
    mkdir(dirname(target), { recursive: true }).then(() => writeFile(partial, bytes)),
  );
  if (!written.ok) return left(`cannot write ${partial}: ${describe(written.error)}`);
  const moved = await wrap(rename(partial, target));
  if (!moved.ok) return left(`cannot write ${target}: ${describe(moved.error)}`);
  return right(target);
}

interface FetchFileOptions extends ModelFileOptions {
  report: (message: string) => void;
}

function fetchFile(
  model: EmbeddingModel,
  options: FetchFileOptions,
): Promise<Either<string, string>> {
  const { file } = options;
  const target = modelFilePath(model, options);
  if (sizeOf(target) === file.bytes) return Promise.resolve(right(target));
  const size =
    file.bytes < 1_000_000
      ? `${Math.ceil(file.bytes / 1000)} kB`
      : `${Math.round(file.bytes / 1_000_000)} MB`;
  options.report(`Downloading ${model.repository}/${file.path} (${size}) to ${target}`);
  return download(model, { file, target });
}

/**
 * Returns the model's files from the cache, and downloads each missing one first. A download is
 * checked against the pinned size and SHA-256 before it gets its final name, so a file in the cache
 * is always complete.
 */
export async function fetchModel(
  model: EmbeddingModel,
  options: FetchModelOptions,
): Promise<Either<string, ModelPaths>> {
  const [weights, vocabulary] = await Promise.all([
    fetchFile(model, { ...options, file: model.weights }),
    fetchFile(model, { ...options, file: model.vocabulary }),
  ]);
  if (!weights.ok) return weights;
  if (!vocabulary.ok) return vocabulary;
  return right({ weights: weights.value, vocabulary: vocabulary.value });
}
