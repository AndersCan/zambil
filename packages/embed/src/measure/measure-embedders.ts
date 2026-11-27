#!/usr/bin/env node
import { arch, cpus, loadavg, release, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  laterMatchCases,
  laterNoMatchCases,
  matchCases,
  noMatchCases,
  proseRepo,
  shortMatchCases,
  shortNoMatchCases,
  taskMatchCases,
  taskNoMatchCases,
} from "./prose-cases.ts";
import { left, right } from "@zambil/core/either";
import { minimumScore, searchModel } from "../model/search-model.ts";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { cacheFolder } from "../model/cache-folder.ts";
import { candidateModels } from "./candidate-models.ts";
import type { CaseResult } from "./evaluate-cases.ts";
import type { Either } from "@zambil/core/either";
import type { EmbeddingModel } from "../model/embedding-model.ts";
import { evaluateCases } from "./evaluate-cases.ts";
import { fileURLToPath } from "node:url";
import { loadRepo } from "@zambil/core/load-repo";
import { openEmbedder } from "../embed/open-embedder.ts";
import type { ProseCase } from "./prose-cases.ts";
import { readMeasureEnvironment } from "./config.ts";
import { spawnSync } from "node:child_process";

/**
 * Each timing runs this many times and keeps the fastest run. The first run warms the disk cache. On
 * a shared machine, other work only adds time, so the fastest run is the closest to the real cost.
 */
const timedRuns = 10;

/** A false match costs more than a miss, because the hook adds each match to the prompt. */
const falseMatchCost = 2;

/** The model that search used before, to compare against. */
const previousModelId = "all-minilm-l6-v2";

const coldStartScript = fileURLToPath(new URL("cold-start.ts", import.meta.url));
const reportPath = fileURLToPath(new URL("../../measurements.md", import.meta.url));
const cliMain = fileURLToPath(new URL("../../../../apps/cli/src/main.ts", import.meta.url));

/** A long prompt, about 300 words, to time the worst case of embedding one query. */
const longQuery = Array.from(
  { length: 30 },
  () => "Please refactor this function so that it handles errors.",
).join(" ");

/** A prompt of 1 MB, as when a user pastes a large log file. */
const pastedQuery = "The checkout total is wrong when a coupon applies. ".repeat(20_000);

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

/** How many expected notes a search finds at a threshold, and how many notes it returns that must not match. */
interface Counts {
  found: number;
  falseMatches: number;
}

interface ThresholdOptions {
  threshold: number;
}

function countAt(results: CaseResult[], options: ThresholdOptions): Counts {
  const counts = { found: 0, falseMatches: 0 };
  for (const result of results) {
    for (const note of result.ranked) {
      if (note.score < options.threshold) continue;
      if (result.expected.includes(note.name)) counts.found += 1;
      else counts.falseMatches += 1;
    }
  }
  return counts;
}

interface Threshold extends Counts {
  threshold: number;
}

/** The threshold, in steps of 0.01, where found notes minus `falseMatchCost` times the false matches is highest. */
function bestThreshold(results: CaseResult[]): Threshold {
  let best = { threshold: 1, found: 0, falseMatches: 0 };
  for (let step = 100; step >= 0; step -= 1) {
    const threshold = step / 100;
    const counts = countAt(results, { threshold });
    const gain = counts.found - falseMatchCost * counts.falseMatches;
    const bestGain = best.found - falseMatchCost * best.falseMatches;
    if (gain > bestGain) best = { threshold, ...counts };
  }
  return best;
}

function describeIterating(results: CaseResult[]): string {
  const iterating = results.find((result) => result.query === "iterating");
  if (iterating === undefined) return "-";
  const place = iterating.expected.includes(iterating.top) ? "first" : "not first";
  const forLoops = score(iterating.expectedScore);
  return `${forLoops} (${place})`;
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

/** The rows of a Markdown table, under its header. */
interface TableOptions {
  rows: string[][];
}

function table(header: string[], options: TableOptions): string[] {
  const lines = [tableRow(header), tableRow(header.map(() => "---"))];
  for (const row of options.rows) lines.push(tableRow(row));
  return lines;
}

function formatSummary(measurements: ModelMeasurement[], timings: Timings): string[] {
  const header = [
    "Model",
    "Size",
    "Top note right",
    "Best threshold",
    "Found",
    "False matches",
    '"iterating"',
    "Cold start",
    "Load model",
    "One query",
    "300-word query",
    "20 descriptions",
  ];
  const rows: string[][] = [];
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
    const best = bestThreshold(results);
    const megabytes = Math.round(model.weights.bytes / 1_000_000);
    rows.push([
      model.id,
      `${megabytes} MB`,
      `${rightTop}/${matches.length}`,
      best.threshold.toFixed(2),
      `${best.found}/${matches.length}`,
      String(best.falseMatches),
      describeIterating(results),
      milliseconds(coldStart.wall),
      milliseconds(coldStart.loadModel),
      milliseconds(coldStart.embedQuery),
      milliseconds(measurement.longQuery),
      milliseconds(measurement.indexRepo),
    ]);
  }
  return table(header, { rows });
}

/** Found notes and false matches of the search model and the previous model at each threshold near the one in use. */
function formatSweep(measurements: ModelMeasurement[]): string[] {
  const compared = measurements.filter((measurement) =>
    [searchModel.id, previousModelId].includes(measurement.model.id),
  );
  const header = ["Threshold", ...compared.map((measurement) => measurement.model.id)];
  const rows: string[][] = [];
  for (let step = 30; step <= 45; step += 1) {
    const threshold = step / 100;
    const row = [threshold.toFixed(2)];
    for (const { results } of compared) {
      const counts = countAt(results, { threshold });
      const iterating = results.find((result) => result.query === "iterating");
      const findsIterating = countAt(iterating === undefined ? [] : [iterating], { threshold });
      const mark = findsIterating.found > 0 ? ', finds "iterating"' : "";
      row.push(`${counts.found} found, ${counts.falseMatches} false${mark}`);
    }
    rows.push(row);
  }
  return table(header, { rows });
}

/** A group of prose cases, as `prose-cases.ts` lists them. */
interface CaseGroup {
  label: string;
  cases: ProseCase[];
}

const caseGroups: CaseGroup[] = [
  { label: "Short texts", cases: [...shortMatchCases, ...shortNoMatchCases] },
  { label: "Task prompts", cases: [...taskMatchCases, ...taskNoMatchCases] },
  { label: "Later cases", cases: [...laterMatchCases, ...laterNoMatchCases] },
];

function formatGroups(measurement: ModelMeasurement): string[] {
  const rows: string[][] = [];
  for (const group of caseGroups) {
    const queries = new Set(group.cases.map((proseCase) => proseCase.query));
    const results = measurement.results.filter((result) => queries.has(result.query));
    const matchCount = group.cases.filter((proseCase) => proseCase.expected.length > 0).length;
    const counts = countAt(results, { threshold: minimumScore });
    const caseCount = String(group.cases.length);
    rows.push([
      group.label,
      caseCount,
      `${counts.found}/${matchCount}`,
      String(counts.falseMatches),
    ]);
  }
  return table(["Group", "Cases", "Found", "False matches"], { rows });
}

function formatFalseMatches(measurement: ModelMeasurement): string[] {
  const lines: string[] = [];
  for (const result of measurement.results) {
    for (const note of result.ranked) {
      const isFalse = note.score >= minimumScore && !result.expected.includes(note.name);
      const noteScore = note.score.toFixed(3);
      if (isFalse) lines.push(`- "${result.query}" finds ${note.name} (${noteScore}).`);
    }
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
  const rows: string[][] = [];
  for (const result of measurement.results) {
    const expected = result.expected.length === 0 ? "(none)" : result.expected.join(", ");
    const scores = [score(result.topScore), score(result.expectedScore), score(result.wrongScore)];
    const query = result.query.replaceAll("|", "\\|");
    rows.push([query, expected, result.top, ...scores]);
  }
  return [`### ${measurement.model.id}`, "", ...table(header, { rows })];
}

function describeMachine(): string {
  const processors = cpus();
  const processor = processors[0]?.model ?? "unknown";
  const system = `${release()} ${arch()}`;
  const [load = 0] = loadavg();
  const loadText = load.toFixed(1);
  return `${processor} (${processors.length} cores), ${system}, Node ${process.version}, load average ${loadText} at the start`;
}

interface CliOptions {
  cacheHome: string;
  input: string;
}

function runCli(args: string[], options: CliOptions): Either<string, number> {
  const compileCache = join(options.cacheHome, "zambil", "node-compile-cache");
  const env = {
    ...process.env,
    XDG_CACHE_HOME: options.cacheHome,
    NODE_COMPILE_CACHE: compileCache,
  };
  const started = performance.now();
  const child = spawnSync(cliMain, [...args, "--repo", proseRepo], {
    encoding: "utf8",
    env,
    input: options.input,
  });
  const wall = performance.now() - started;
  const command = args.join(" ");
  if (child.status !== 0) return left(`zambil ${command} failed: ${child.stderr}`);
  return right(wall);
}

/** Which cache the hook finds: the model and a full index, the model and no index, or nothing. */
type HookCache = "indexed" | "unindexed" | "empty";

/** One `UserPromptSubmit` run of `zambil hook` to time. */
interface HookCase {
  label: string;
  prompt: string;
  cache: HookCache;
}

const hookCases: HookCase[] = [
  {
    label: "A slash command, `/compact`. The hook does not search.",
    prompt: "/compact",
    cache: "indexed",
  },
  { label: '"iterating", with the index', prompt: "iterating", cache: "indexed" },
  { label: "A 300-word prompt, with the index", prompt: longQuery, cache: "indexed" },
  { label: "A pasted prompt of 1 MB, with the index", prompt: pastedQuery, cache: "indexed" },
  {
    label: '"iterating", with no index. The hook embeds 10 of the 20 descriptions.',
    prompt: "iterating",
    cache: "unindexed",
  },
  {
    label: '"iterating", with no model. The hook does not search.',
    prompt: "iterating",
    cache: "empty",
  },
];

/** The cache folders for each `HookCache`. The one with no index links to the models of the real cache. */
function hookCacheHomes(options: FolderOptions): Map<HookCache, string> {
  const unindexed = mkdtempSync(join(tmpdir(), "zambil-measure-unindexed-"));
  mkdirSync(join(unindexed, "zambil"));
  symlinkSync(join(options.folder, "models"), join(unindexed, "zambil", "models"));
  const empty = mkdtempSync(join(tmpdir(), "zambil-measure-empty-"));
  return new Map([
    ["indexed", dirname(options.folder)],
    ["unindexed", unindexed],
    ["empty", empty],
  ]);
}

/** The cold start of each model, of the whole `zambil search` command after `zambil index`, and of each hook case. */
interface Timings {
  coldStarts: Map<string, ColdStart>;
  cliSearch: number;
  hooks: number[];
}

function hookPayload(prompt: string): string {
  return JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt });
}

/**
 * Times the cold starts in rounds: each round starts each model once, runs `zambil search` once and
 * runs each hook case once. So a busy moment on the machine slows every case, not only one.
 */
function measureTimings(models: EmbeddingModel[], options: FolderOptions): Either<string, Timings> {
  const homes = hookCacheHomes(options);
  const cacheHome = dirname(options.folder);
  const indexed = runCli(["index"], { cacheHome, input: "" });
  if (!indexed.ok) return indexed;
  const runs = new Map<string, ColdStart[]>();
  const cliRuns: number[] = [];
  const hookRuns: number[][] = hookCases.map(() => []);
  for (let round = 0; round < timedRuns; round += 1) {
    for (const model of models) {
      const measured = runColdStart(model, options);
      if (!measured.ok) return measured;
      runs.set(model.id, [...(runs.get(model.id) ?? []), measured.value]);
    }
    const wall = runCli(["search", "my branch is behind main"], { cacheHome, input: "" });
    if (!wall.ok) return wall;
    cliRuns.push(wall.value);
    for (const [position, hookCase] of hookCases.entries()) {
      const home = homes.get(hookCase.cache) ?? cacheHome;
      const hookWall = runCli(["hook"], { cacheHome: home, input: hookPayload(hookCase.prompt) });
      if (!hookWall.ok) return hookWall;
      hookRuns[position]?.push(hookWall.value);
    }
  }
  const coldStarts = new Map<string, ColdStart>();
  for (const [id, modelRuns] of runs) coldStarts.set(id, fastestColdStart(modelRuns));
  const hooks = hookRuns.map((caseRuns) => fastest(caseRuns));
  return right({ coldStarts, cliSearch: fastest(cliRuns), hooks });
}

function formatHooks(timings: Timings): string[] {
  const [baseline = 0] = timings.hooks;
  const rows: string[][] = [];
  for (const [position, hookCase] of hookCases.entries()) {
    const wall = timings.hooks[position] ?? 0;
    const added = position === 0 ? "-" : milliseconds(wall - baseline);
    rows.push([hookCase.label, milliseconds(wall), added]);
  }
  return table(["Case", "Whole hook", "Added by the search"], { rows });
}

function formatReport(measurements: ModelMeasurement[], timings: Timings): string {
  const matchCount = matchCases.length;
  const caseCounts = `${matchCount} texts that must find one note, and ${noMatchCases.length} texts that must find none`;
  const current = measurements.find((measurement) => measurement.model.id === searchModel.id);
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
    `- Best threshold: the score, in steps of 0.01, where the found notes minus ${falseMatchCost} times the false matches is highest. A search returns at most 3 notes that score at least that much.`,
    "- Found, False matches: at that threshold, the expected notes that a search returns, and the notes that it returns but must not.",
    '- "iterating": the score of the for-loops note for "iterating", and whether it is the best note.',
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
    "## Thresholds",
    "",
    `zambil uses ${searchModel.id} with the threshold ${minimumScore}. Found notes and false matches of the search model and the previous model, at each threshold, out of ${matchCount} match cases:`,
    "",
    ...formatSweep(measurements),
    "",
    `${searchModel.id} at ${minimumScore}, by group of cases. The later cases were written after the threshold was chosen:`,
    "",
    ...(current === undefined ? [] : formatGroups(current)),
    "",
    `The false matches of ${searchModel.id} at ${minimumScore}:`,
    "",
    ...(current === undefined ? [] : formatFalseMatches(current)),
    "",
    "## The hook on each prompt",
    "",
    `\`zambil hook\` at \`UserPromptSubmit\`, as Claude Code runs it: a new Node process with \`NODE_COMPILE_CACHE\`, the prose repo, and the payload on standard input. The fastest of ${timedRuns} runs. "Added by the search" is the time over the slash command, which loads the repo but not the model.`,
    "",
    ...formatHooks(timings),
    "",
    "## Scores per case",
    "",
  ];
  const compared = measurements.filter((measurement) =>
    [searchModel.id, previousModelId].includes(measurement.model.id),
  );
  for (const measurement of compared) lines.push(...formatCases(measurement), "");
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
  process.stderr.write("Timing the cold starts and the hook\n");
  const timings = measureTimings(candidateModels, { folder });
  if (!timings.ok) throw new Error(timings.error);
  writeFileSync(reportPath, formatReport(measurements, timings.value));
  process.stderr.write(`Wrote ${reportPath}\n`);
}

await main();
