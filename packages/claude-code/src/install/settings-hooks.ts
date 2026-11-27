import { left, right } from "@zambil/core/either";
import { asRecord } from "@zambil/core/as-record";
import type { Either } from "@zambil/core/either";

/** Claude Code settings as parsed JSON. zambil reads and changes only `hooks`. */
export type Settings = Record<string, unknown>;

/** The command line that each zambil hook runs, and the hooks that run it. */
export interface InstallHooksOptions {
  command: string;
  hookNames: string[];
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
}

/** A group without a `matcher` runs for every tool. zambil filters by `tools` itself, so it needs one. */
function matchesEveryTool(group: unknown): boolean {
  const matcher = asRecord(group)?.matcher;
  return matcher === undefined || matcher === "" || matcher === "*";
}

/**
 * Puts the handler in place of the first zambil handler in a group for every tool, or in a new group
 * at the end. Each other zambil handler goes away, so the hook runs once.
 */
function withHandler(groups: unknown[], options: ReplaceOptions): unknown[] {
  const position = groups.findIndex(
    (group) => matchesEveryTool(group) && handlersOf(group).some(isZambilHandler),
  );
  if (position === -1) return [...withoutZambil(groups), { hooks: [options.handler] }];
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
  const changed: Record<string, unknown[]> = {};
  for (const [event, groups] of Object.entries(events.value)) {
    changed[event] = options.hookNames.includes(event)
      ? withHandler(groups, { handler })
      : withoutZambil(groups);
  }
  for (const event of options.hookNames) {
    if (changed[event] === undefined) changed[event] = [{ hooks: [handler] }];
  }
  return right(withEvents(settings, { before: events.value, after: changed }));
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
