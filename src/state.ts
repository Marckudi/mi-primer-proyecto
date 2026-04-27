import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { ContentItem, PostStatus } from "./types.js";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const STATE_FILE = join(DATA_DIR, "state.json");

type State = Record<string, Record<string, ContentItem>>;

function load(): State {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as State;
  } catch {
    return {};
  }
}

function save(state: State): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function hasBeenGenerated(date: string, hora: string): boolean {
  return !!load()[date]?.[hora];
}

export function getContentForDate(date: string): Record<string, ContentItem> {
  return load()[date] ?? {};
}

export function saveContent(item: ContentItem): void {
  const state = load();
  (state[item.date] ??= {})[item.hora] = item;
  save(state);
}

export function updateStatus(
  date: string,
  hora: string,
  status: PostStatus,
  extra?: { instagramPostId?: string; publishedAt?: string },
): void {
  const state = load();
  if (!state[date]?.[hora]) return;
  state[date][hora] = { ...state[date][hora], status, ...extra };
  save(state);
}
