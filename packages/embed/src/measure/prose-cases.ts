import { fileURLToPath } from "node:url";

/** The repo that the prose cases search. `cache/today.md` in it is expired. */
export const proseRepo = fileURLToPath(new URL("../../fixtures/prose-repo", import.meta.url));

/** A text a user could type, and the notes that may match it. An empty list means that no note may match. */
export interface ProseCase {
  query: string;
  expected: string[];
}

/** Texts that must find a note with other words than its description uses. */
export const matchCases: ProseCase[] = [
  { query: "iterating", expected: ["for-loops"] },
  { query: "go over every item in a list", expected: ["for-loops"] },
  { query: "my branch is behind main", expected: ["rebase"] },
  { query: "fix the merge conflicts", expected: ["rebase"] },
  { query: "describe my changes for git", expected: ["commit-messages"] },
  { query: "ship the website to the live servers", expected: ["deploy"] },
  { query: "add a column to the users table", expected: ["migrations"] },
  { query: "should this function throw?", expected: ["error-handling"] },
  { query: "add a test for this function", expected: ["unit-tests"] },
  { query: "the container does not start on my laptop", expected: ["docker"] },
  { query: "which colour should this button have", expected: ["css-tokens"] },
  { query: "look at this PR before I merge it", expected: ["code-review"] },
  { query: "publish a new version of the library", expected: ["release"] },
  { query: "install the dependencies of a Python script", expected: ["virtual-environments"] },
  { query: "the server is slow, find out why", expected: ["profiling"] },
  { query: "where do I keep the database password", expected: ["secrets"] },
  { query: "convert a timestamp to local time", expected: ["dates"] },
  { query: "match an email address with a pattern", expected: ["regular-expressions"] },
  { query: "blind users cannot use the signup form", expected: ["accessibility"] },
  { query: "give this variable a clearer name", expected: ["naming"] },
  { query: "print what the service does so I can debug it", expected: ["logging"] },
];

/** Texts that no note in the repo is about. "what day is it" asks for the expired note, so it must not match either. */
export const noMatchCases: ProseCase[] = [
  { query: "what day is it", expected: [] },
  { query: "bake sourdough bread", expected: [] },
  { query: "what is the capital of France", expected: [] },
  { query: "hello", expected: [] },
  { query: "thanks, that looks good", expected: [] },
  { query: "yes", expected: [] },
  { query: "continue", expected: [] },
  { query: "book a flight to Oslo", expected: [] },
  { query: "write a poem about the sea", expected: [] },
  { query: "summarize this file", expected: [] },
  { query: "explain how photosynthesis works", expected: [] },
  { query: "the cat knocked a glass off the table", expected: [] },
];
