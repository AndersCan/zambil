import { basename, dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { EmbeddingModel, ModelFile } from "./embedding-model.ts";
import { left, right, wrap } from "@zambil/core/either";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import type { Either } from "@zambil/core/either";
import { statSync } from "node:fs";

/** The local paths of a model's files, after they are in the cache and verified. */
export interface ModelPaths {
  weights: string;
  vocabulary: string;
}

/** `never`: a file that is not in the cache is an error, so that an agent hook never waits for a download. */
export type ModelDownload = "allow" | "never";

/** The zambil cache folder, where to tell the user that a download starts, and whether to download. */
export interface FetchModelOptions {
  cacheFolder: string;
  report: (message: string) => void;
  download: ModelDownload;
}

/** The longest time that one model file can take to download, in milliseconds. */
const downloadTimeout = 600_000;

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
  const response = await wrap(fetch(url, { signal: AbortSignal.timeout(downloadTimeout) }));
  if (!response.ok) {
    const reason = describe(response.error);
    return left(
      `cannot download ${url}: ${reason}. Check the connection to huggingface.co and run the command again.`,
    );
  }
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
  const partial = `${target}.${randomUUID()}.partial`;
  const written = await wrap(
    mkdir(dirname(target), { recursive: true }).then(() => writeFile(partial, bytes)),
  );
  const moved = written.ok ? await wrap(rename(partial, target)) : written;
  if (!moved.ok) {
    await rm(partial, { force: true });
    return left(`cannot write ${target}: ${describe(moved.error)}`);
  }
  return right(target);
}

function formatSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1000)} kB`;
  const megabytes = Math.round(bytes / 1_000_000);
  return `${megabytes} MB`;
}

/**
 * Returns the model's files from the cache, and downloads each missing one first, unless `download`
 * is `never`. A download is checked against the pinned size and SHA-256 before it gets its final
 * name, so a file in the cache is always complete.
 */
export async function fetchModel(
  model: EmbeddingModel,
  options: FetchModelOptions,
): Promise<Either<string, ModelPaths>> {
  const { cacheFolder } = options;
  const files = [model.weights, model.vocabulary];
  const missing = files.filter(
    (file) => sizeOf(modelFilePath(model, { file, cacheFolder })) !== file.bytes,
  );
  const folder = dirname(modelFilePath(model, { file: model.weights, cacheFolder }));
  if (missing.length > 0 && options.download === "never") {
    return left(
      `the model ${model.repository} is not in ${folder}. Run \`zambil index\` to download it.`,
    );
  }
  if (missing.length > 0) {
    let bytes = 0;
    for (const file of missing) bytes += file.bytes;
    options.report(`Downloading the model ${model.repository} (${formatSize(bytes)}) to ${folder}`);
  }
  const downloads = await Promise.all(
    missing.map((file) =>
      download(model, { file, target: modelFilePath(model, { file, cacheFolder }) }),
    ),
  );
  for (const downloaded of downloads) {
    if (!downloaded.ok) return downloaded;
  }
  return right({
    weights: modelFilePath(model, { file: model.weights, cacheFolder }),
    vocabulary: modelFilePath(model, { file: model.vocabulary, cacheFolder }),
  });
}
