#!/usr/bin/env node
import { arch, cpus, loadavg, release, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { left, right } from "@zambil/core/either";
import { matchCases, noMatchCases, proseRepo } from "./prose-cases.ts";
import { cacheFolder } from "../model/cache-folder.ts";
import { candidateModels } from "./candidate-models.ts";
import type { CaseResult } from "./evaluate-cases.ts";
import type { Either } from "@zambil/core/either";
import type { EmbeddingModel } from "../model/embedding-model.ts";
import { evaluateCases } from "./evaluate-cases.ts";
import { fileURLToPath } from "node:url";
import { loadRepo } from "@zambil/core/load-repo";
import { openEmbedder } from "../embed/open-embedder.ts";
import { readMeasureEnvironment } from "./config.ts";
import { searchModel } from "../model/search-model.ts";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/**
 * Each timing runs this many times and keeps the fastest run. The first run warms the disk cache. On
 * a shared machine, other work only adds time, so the fastest run is the closest to the real cost.
 */
const timedRuns = 10;

const coldStartScript = fileURLToPath(new URL("cold-start.ts", import.meta.url));
const reportPath = fileURLToPath(new URL("../../measurements.md", import.meta.url));
const cliMain = fileURLToPath(new URL("../../../../apps/cli/src/main.ts", import.meta.url));

/** A long prompt, about 300 words, to time the worst case of embedding one query. */
const longQuery = Array.from(
  { length: 30 },
  () => "Please refactor this function so that it handles errors.",
).join(" ");

interface ColdStart {
  wall: number;
  importCode: number;
  loadModel: number;
  embedQuery: number;
}

interface ModelMeasurement {
  model: EmbeddingModel;
  results: CaseResult[];
  longQuery: number;
  indexRepo: number;
}

function fastest(values: number[]): number {
  return Math.min(...values);
}

function parseColdStart(stdout: string): Omit<ColdStart, "wall"> | undefined {
  const times: unknown = JSON.parse(stdout);
  if (typeof times !== "object" || times === null) return undefined;
  const { importCode, loadModel, embedQuery } = Object.fromEntries(Object.entries(times));
  const isTimes =
    typeof importCode === "number" &&
    typeof loadModel === "number" &&
    typeof embedQuery === "number";
  return isTimes ? { importCode, loadModel, embedQuery } : undefined;
}

interface FolderOptions {
  folder: string;
}

function runColdStart(model: EmbeddingModel, options: FolderOptions): Either<string, ColdStart> {
  const started = performance.now();
  const child = spawnSync(process.execPath, [coldStartScript, model.id, options.folder], {
    encoding: "utf8",
  });
  const wall = performance.now() - started;
  if (child.status !== 0) return left(`the cold start of ${model.id} failed: ${child.stderr}`);
  const times = parseColdStart(child.stdout);
  if (times === undefined) return left(`the cold start of ${model.id} printed ${child.stdout}`);
  return right({ ...times, wall });
}

function fastestColdStart(runs: ColdStart[]): ColdStart {
  return {
    wall: fastest(runs.map((run) => run.wall)),
    importCode: fastest(runs.map((run) => run.importCode)),
    loadModel: fastest(runs.map((run) => run.loadModel)),
    embedQuery: fastest(runs.map((run) => run.embedQuery)),
  };
}

async function timeFastest(work: () => Promise<unknown>): Promise<number> {
  const times: number[] = [];
  // one at a time: each run is timed alone
  for (let run = 0; run < timedRuns; run += 1) {
    const started = performance.now();
    await work();
    times.push(performance.now() - started);
  }
  return fastest(times);
}

interface MeasureOptions {
  folder: string;
  now: Date;
}

async function measureModel(
  model: EmbeddingModel,
  options: MeasureOptions,
): Promise<Either<string, ModelMeasurement>> {
  const repo = loadRepo(proseRepo);
  if (!repo.ok) return left(repo.error.message);
  const embedder = await openEmbedder(model, {
    cacheFolder: options.folder,
    report: (message) => process.stderr.write(`${message}\n`),
    download: "allow",
  });
  if (!embedder.ok) return embedder;
  const emptyIndexFolder = join(tmpdir(), "zambil-measure-no-index");
  const evaluated = await evaluateCases(repo.value, {
    cases: [...matchCases, ...noMatchCases],
    embedder: embedder.value,
    now: options.now,
    cacheFolder: emptyIndexFolder,
  });
  if (!evaluated.ok) return evaluated;
  const descriptions: string[] = [];
  for (const note of repo.value.notes) descriptions.push(note.description ?? "");
  return right({
    model,
    results: evaluated.value,
    longQuery: await timeFastest(() => embedder.value.embed([longQuery], { role: "query" })),
    indexRepo: await timeFastest(() => embedder.value.embed(descriptions, { role: "document" })),
  });
}

/** The lowest score, in steps of 0.01, that is above every score of a note that must not match. */
function zeroFalseThreshold(results: CaseResult[]): number {
  const highestWrong = Math.max(...results.map((result) => result.wrongScore));
  return Math.floor(highestWrong * 100 + 1) / 100;
}

interface ThresholdOptions {
  threshold: number;
}

function isFound(result: CaseResult, options: ThresholdOptions): boolean {
  return result.expected.includes(result.top) && result.topScore >= options.threshold;
}

function score(value: number | undefined): string {
  return value === undefined ? "-" : value.toFixed(3);
}

function milliseconds(value: number): string {
  return `${Math.round(value)} ms`;
}

function tableRow(cells: string[]): string {
  const joined = cells.join(" | ");
  return `| ${joined} |`;
}

function formatSummary(measurements: ModelMeasurement[], timings: Timings): string[] {
  const header = [
    "Model",
    "Size",
    "Top note right",
    "No false match at",
    "Found at that score",
    "Cold start",
    "Load model",
    "One query",
    "300-word query",
    "20 descriptions",
  ];
  const lines = [tableRow(header), tableRow(header.map(() => "---"))];
  for (const measurement of measurements) {
    const { model, results } = measurement;
    const coldStart = timings.coldStarts.get(model.id) ?? {
      wall: 0,
      importCode: 0,
      loadModel: 0,
      embedQuery: 0,
    };
    const matches = results.filter((result) => result.expected.length > 0);
    const rightTop = matches.filter((result) => result.expected.includes(result.top)).length;
    const threshold = zeroFalseThreshold(results);
    const found = matches.filter((result) => isFound(result, { threshold })).length;
    const megabytes = Math.round(model.weights.bytes / 1_000_000);
    lines.push(
      tableRow([
        model.id,
        `${megabytes} MB`,
        `${rightTop}/${matches.length}`,
        threshold.toFixed(2),
        `${found}/${matches.length}`,
        milliseconds(coldStart.wall),
        milliseconds(coldStart.loadModel),
        milliseconds(coldStart.embedQuery),
        milliseconds(measurement.longQuery),
        milliseconds(measurement.indexRepo),
      ]),
    );
  }
  return lines;
}

function formatCases(measurement: ModelMeasurement): string[] {
  const header = [
    "Query",
    "Expected",
    "Top note",
    "Top score",
    "Expected score",
    "Best wrong score",
  ];
  const lines = [
    `### ${measurement.model.id}`,
    "",
    tableRow(header),
    tableRow(header.map(() => "---")),
  ];
  for (const result of measurement.results) {
    const expected = result.expected.length === 0 ? "(none)" : result.expected.join(", ");
    const scores = [score(result.topScore), score(result.expectedScore), score(result.wrongScore)];
    lines.push(tableRow([result.query, expected, result.top, ...scores]));
  }
  return lines;
}

function describeMachine(): string {
  const processors = cpus();
  const processor = processors[0]?.model ?? "unknown";
  const system = `${release()} ${arch()}`;
  const [load = 0] = loadavg();
  const loadText = load.toFixed(1);
  return `${processor} (${processors.length} cores), ${system}, Node ${process.version}, load average ${loadText} at the start`;
}

function runCli(args: string[], options: FolderOptions): Either<string, number> {
  const env = { ...process.env, XDG_CACHE_HOME: dirname(options.folder) };
  const started = performance.now();
  const child = spawnSync(cliMain, [...args, "--repo", proseRepo], { encoding: "utf8", env });
  const wall = performance.now() - started;
  const command = args.join(" ");
  if (child.status !== 0) return left(`zambil ${command} failed: ${child.stderr}`);
  return right(wall);
}

/** The cold start of each model, and of the whole `zambil search` command after `zambil index`. */
interface Timings {
  coldStarts: Map<string, ColdStart>;
  cliSearch: number;
}

/**
 * Times the cold starts in rounds: each round starts each model once and runs `zambil search` once.
 * So a busy moment on the machine slows every model, not only the one that runs at that moment.
 */
function measureTimings(models: EmbeddingModel[], options: FolderOptions): Either<string, Timings> {
  const indexed = runCli(["index"], options);
  if (!indexed.ok) return indexed;
  const runs = new Map<string, ColdStart[]>();
  const cliRuns: number[] = [];
  for (let round = 0; round < timedRuns; round += 1) {
    for (const model of models) {
      const measured = runColdStart(model, options);
      if (!measured.ok) return measured;
      runs.set(model.id, [...(runs.get(model.id) ?? []), measured.value]);
    }
    const wall = runCli(["search", "my branch is behind main"], options);
    if (!wall.ok) return wall;
    cliRuns.push(wall.value);
  }
  const coldStarts = new Map<string, ColdStart>();
  for (const [id, modelRuns] of runs) coldStarts.set(id, fastestColdStart(modelRuns));
  return right({ coldStarts, cliSearch: fastest(cliRuns) });
}

function formatReport(measurements: ModelMeasurement[], timings: Timings): string {
  const caseCounts = `${matchCases.length} texts that must find one note, and ${noMatchCases.length} texts that must find none`;
  const lines = [
    "# Embedder measurements",
    "",
    "`node packages/embed/src/measure/measure-embedders.ts` writes this file. Do not edit it by hand. `README.md` in this folder says which model zambil uses and why.",
    "",
    `Machine: ${describeMachine()}.`,
    "",
    `The prose cases are in \`src/measure/prose-cases.ts\`: ${caseCounts}. The notes are in \`fixtures/prose-repo\`.`,
    "",
    "The columns:",
    "",
    "- Top note right: for how many match cases the best note is the expected note.",
    "- No false match at: the lowest score, in steps of 0.01, above the score of every note that must not match, in all cases.",
    "- Found at that score: for how many match cases the best note is the expected note and scores at least that much.",
    `- Cold start: a new Node process loads the code and the model and embeds one query. The fastest of ${timedRuns} runs. The runs go in rounds, one run of each model per round, so that a busy moment slows each model.`,
    "- Load model, One query: the parts of the cold start that the process measured itself.",
    `- 300-word query, 20 descriptions: the time to embed with a loaded model, the fastest of ${timedRuns} runs.`,
    "",
    "## Summary",
    "",
    ...formatSummary(measurements, timings),
    "",
    `The whole \`zambil search\` command, with ${searchModel.id}, the index in the cache and the 20 notes of the prose repo, takes ${milliseconds(timings.cliSearch)} from the start of the process to its exit. The fastest of ${timedRuns} runs.`,
    "",
    "## Scores per case",
    "",
  ];
  for (const measurement of measurements) lines.push(...formatCases(measurement), "");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const folder = cacheFolder(readMeasureEnvironment());
  const now = new Date();
  const measurements: ModelMeasurement[] = [];
  // one at a time: each model is timed alone
  for (const model of candidateModels) {
    process.stderr.write(`Measuring ${model.id}\n`);
    const measured = await measureModel(model, { folder, now });
    if (!measured.ok) throw new Error(measured.error);
    measurements.push(measured.value);
  }
  process.stderr.write("Timing the cold starts\n");
  const timings = measureTimings(candidateModels, { folder });
  if (!timings.ok) throw new Error(timings.error);
  writeFileSync(reportPath, formatReport(measurements, timings.value));
  process.stderr.write(`Wrote ${reportPath}\n`);
}

await main();
