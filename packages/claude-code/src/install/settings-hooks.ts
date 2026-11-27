import { left, right } from "@zambil/core/either";
import { asRecord } from "@zambil/core/as-record";
import type { Either } from "@zambil/core/either";

/** Claude Code settings as parsed JSON. zambil reads and changes only `hooks`. */
export type Settings = Record<string, unknown>;

/**
 * The command line that each zambil hook runs, the hooks that run it, and the `matcher` of a tool hook
 * that runs only for some tools. A hook without a matcher runs for every tool.
 */
export interface InstallHooksOptions {
  command: string;
  hookNames: string[];
  matchers?: Record<string, string>;
}

/** The seconds that Claude Code waits for `zambil hook` before it goes on without it. */
const hookTimeout = 10;

const zambilHookCommand = /(?:^|[\s/'"])zambil['"]?\s+hook(?:\s|$)/;

/** A hook handler that runs `zambil hook`, by any path. The user's own hooks never match. */
function isZambilHandler(handler: unknown): boolean {
  const command = asRecord(handler)?.command;
  return typeof command === "string" && zambilHookCommand.test(command);
}

function handlersOf(group: unknown): unknown[] {
  const handlers = asRecord(group)?.hooks;
  return Array.isArray(handlers) ? handlers : [];
}

function readHooks(settings: Settings): Either<string, Record<string, unknown[]>> {
  if (settings.hooks === undefined) return right({});
  const hooks = asRecord(settings.hooks);
  if (hooks === undefined) return left("its `hooks` value is not an object");
  const events: Record<string, unknown[]> = {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) return left(`its \`hooks.${event}\` value is not a list`);
    events[event] = groups;
  }
  return right(events);
}

/** The groups without the zambil handlers. A group that held only zambil handlers goes away. */
function withoutZambil(groups: unknown[]): unknown[] {
  const kept: unknown[] = [];
  for (const group of groups) {
    const handlers = handlersOf(group);
    const others = handlers.filter((handler) => !isZambilHandler(handler));
    if (others.length === handlers.length) kept.push(group);
    else if (others.length > 0) kept.push({ ...asRecord(group), hooks: others });
  }
  return kept;
}

interface ReplaceOptions {
  handler: Record<string, unknown>;
  matcher: string | undefined;
}

/** The `matcher` of a group. No matcher, an empty one and `*` all run for every tool, so they read as `undefined`. */
function matcherOf(group: unknown): string | undefined {
  const matcher = asRecord(group)?.matcher;
  if (typeof matcher !== "string") return undefined;
  const isEveryTool = matcher === "" || matcher === "*";
  return isEveryTool ? undefined : matcher;
}

function newGroup(options: ReplaceOptions): Record<string, unknown> {
  const group: Record<string, unknown> = { hooks: [options.handler] };
  if (options.matcher !== undefined) return { matcher: options.matcher, ...group };
  return group;
}

/**
 * Puts the handler in place of the first zambil handler in a group with the matcher that zambil needs,
 * or in a new group at the end. Each other zambil handler goes away, so the hook runs once.
 */
function withHandler(groups: unknown[], options: ReplaceOptions): unknown[] {
  const position = groups.findIndex(
    (group) => matcherOf(group) === options.matcher && handlersOf(group).some(isZambilHandler),
  );
  if (position === -1) return [...withoutZambil(groups), newGroup(options)];
  const group = asRecord(groups[position]);
  const handlers = handlersOf(group);
  const first = handlers.findIndex(isZambilHandler);
  const replaced: unknown[] = [];
  const { command } = options.handler;
  for (const [index, handler] of handlers.entries()) {
    const updated = { ...options.handler, ...asRecord(handler), command };
    if (index === first) replaced.push(updated);
    else if (!isZambilHandler(handler)) replaced.push(handler);
  }
  const before = withoutZambil(groups.slice(0, position));
  const after = withoutZambil(groups.slice(position + 1));
  return [...before, { ...group, hooks: replaced }, ...after];
}

interface WithEventsOptions {
  before: Record<string, unknown[]>;
  after: Record<string, unknown[]>;
}

/** Writes the changed events back. An event or a `hooks` object goes away only when zambil emptied it. */
function withEvents(settings: Settings, options: WithEventsOptions): Settings {
  const { before, after } = options;
  const hooks: Record<string, unknown[]> = {};
  for (const [event, groups] of Object.entries(after)) {
    const wasEmpty = before[event]?.length === 0;
    if (groups.length > 0 || wasEmpty) hooks[event] = groups;
  }
  const changed: Settings = { ...settings, hooks };
  const isEmptied = Object.keys(hooks).length === 0 && Object.keys(before).length > 0;
  const isUnset = Object.keys(hooks).length === 0 && settings.hooks === undefined;
  if (isEmptied || isUnset) delete changed.hooks;
  return changed;
}

/**
 * The settings with one `zambil hook` handler at each named hook, and none at the other hooks. A
 * zambil handler that is already there keeps its place. Every other key and handler stays as it was,
 * so a second run gives the same settings.
 */
export function installHooks(
  settings: Settings,
  options: InstallHooksOptions,
): Either<string, Settings> {
  const events = readHooks(settings);
  if (!events.ok) return events;
  const handler = { type: "command", command: options.command, timeout: hookTimeout };
  const matchers = options.matchers ?? {};
  const changed: Record<string, unknown[]> = {};
  for (const [event, groups] of Object.entries(events.value)) {
    const matcher = matchers[event];
    changed[event] = options.hookNames.includes(event)
      ? withHandler(groups, { handler, matcher })
      : withoutZambil(groups);
  }
  for (const event of options.hookNames) {
    const matcher = matchers[event];
    if (changed[event] === undefined) changed[event] = [newGroup({ handler, matcher })];
  }
  return right(withEvents(settings, { before: events.value, after: changed }));
}

/** Each event that runs `zambil hook`, with the command line of each of its zambil handlers. */
export function listZambilHooks(settings: Settings): Either<string, Record<string, string[]>> {
  const events = readHooks(settings);
  if (!events.ok) return events;
  const found: Record<string, string[]> = {};
  for (const [event, groups] of Object.entries(events.value)) {
    const commands: string[] = [];
    for (const group of groups) {
      for (const handler of handlersOf(group)) {
        const command = asRecord(handler)?.command;
        if (typeof command === "string" && isZambilHandler(handler)) commands.push(command);
      }
    }
    if (commands.length > 0) found[event] = commands;
  }
  return right(found);
}

/**
 * The `matcher` of the first zambil handler of each event that runs `zambil hook`. `undefined` means
 * that it runs for every tool.
 */
export function listZambilMatchers(
  settings: Settings,
): Either<string, Record<string, string | undefined>> {
  const events = readHooks(settings);
  if (!events.ok) return events;
  const found: Record<string, string | undefined> = {};
  for (const [event, groups] of Object.entries(events.value)) {
    const group = groups.find((candidate) => handlersOf(candidate).some(isZambilHandler));
    if (group !== undefined) found[event] = matcherOf(group);
  }
  return right(found);
}

/** The settings without any `zambil hook` handler. Every other key and handler stays as it was. */
export function uninstallHooks(settings: Settings): Either<string, Settings> {
  const events = readHooks(settings);
  if (!events.ok) return events;
  const changed: Record<string, unknown[]> = {};
  for (const [event, groups] of Object.entries(events.value)) {
    changed[event] = withoutZambil(groups);
  }
  return right(withEvents(settings, { before: events.value, after: changed }));
}
