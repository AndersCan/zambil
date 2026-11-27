# @zambil/embed

Similarity search for zambil. An embedder is a model that turns a text into a vector, so that texts with a similar meaning get vectors that are close. This package matches a text, such as a prompt, against the `description` and the `triggers` of each note. It runs the model on your machine with ONNX Runtime.

The `zambil index` and `zambil search <text>` commands in `apps/cli` use it. So does `zambil hook` at `UserPromptSubmit`, through `packages/claude-code`. If the model is in the cache, `zambil save` uses it to add a new description or trigger to the index. It never downloads the model.

## The model

zambil uses multi-qa-MiniLM-L6-cos-v1, quantized to 8 bits (23 MB), from the `Xenova/multi-qa-MiniLM-L6-cos-v1` repo on Hugging Face. It was trained to match a short question to a passage. `src/model/search-model.ts` pins the commit and the size and SHA-256 of each file.

zambil downloads the model the first time that `zambil index` or `zambil search` needs it. It does not use a model that is already on the machine. The files go to `$XDG_CACHE_HOME/zambil/models/`. If `XDG_CACHE_HOME` is not set, the folder is `~/.cache/zambil/models/`. A download is written to a temporary file first. zambil gives it its final name only after the size and the SHA-256 match the pins. So a file in the cache is always complete. If a download fails, the command stops with an error and keeps no file.

The agent hook never downloads the model. If the model is not in the cache, the hook adds no similar notes and tells you on standard error to run `zambil index`.

ONNX Runtime also writes a small `Microsoft/DeveloperTools` folder in `$XDG_CACHE_HOME`, outside the `zambil` folder.

The `onnxruntime-node` package has prebuilt binaries for Linux (x64, arm64), macOS (arm64) and Windows. Its install script only adds GPU support, so `pnpm-workspace.yaml` skips that script.

## Index and search

`zambil index` embeds the description and each trigger of every note and writes the vectors to `$XDG_CACHE_HOME/zambil/index/<hash of the repo path>.index`. It never writes to the repo. The file is a short JSON header with the texts, then one block of 32-bit floats. A search reads the vectors from that block without a parse, so the index of 20,000 notes (32 MB) loads in about 20 ms. An index of an older zambil, in a `.json` file, is not read. Run `zambil index` once to write the new file. A second run embeds only the texts that changed. The index belongs to one model. After a change of model, the old index is not used, and the next `zambil index` embeds every text again.

`zambil search` loads the repo, leaves out each expired note, and scores the description and each trigger of each other note against the text. A note takes its best score. The score is the cosine similarity, from -1 to 1. It returns at most 3 notes that score 0.38 or more, best first. It checks expiry each time it runs, never in the index, so a note that expires after `zambil index` is left out at once. If a description or a trigger is not in the index, search embeds it at query time. The result is the same, only slower, and the command tells you to run `zambil index`. The hook embeds at most 10 such texts on each prompt. It does not score the other texts, so a repo with no index does not slow down each prompt.

The model reads the first 256 tokens of a text. A token is a word or a part of a word. zambil reads at most 100 characters per token before it splits the text, so a pasted file of megabytes does not slow down the hook.

After a pasted log or file, the question is often at the end, and the model does not read that far. Search scores only the whole text, so such a question can miss its note. The cases in `src/measure/prose-cases.ts` include four pastes that end with a question, to show the gap. Two fixes were tried and are not in zambil:

- The last 256 tokens of the text. After 40 lines of a log, they hold mostly log lines, and the question at the end scores under 0.2.
- The last paragraph alone. It finds the question after a paste, at 0.98 for the log. But a side remark after a task, such as "No need to write tests.", then matches the notes about tests. A rule that tells a paste from prose must come first.

The model embeds one text at a time. The 8-bit model scales its numbers over a whole batch. So a text in a batch of 16 gets a vector that differs by up to 0.035 in score. One text at a time gives each description one vector, with or without an index.

## Triggers

A note can list `triggers`: prompts that the note is for, as you type them. Search embeds each trigger as its own text, and the note takes its best score. A trigger raises the score of the prompts that are like it, and the threshold stays the same for all notes. Example: for "open a PR for this", the description "How to open a pull request and write its description." scores 0.32, under the threshold. The trigger "open a PR" scores 0.90. `src/search/search-notes.test.ts` checks this case with the real model.

A short trigger matches more prompts than a long one. So write a trigger with the words of a real prompt, not one word.

## Other languages

The model was trained on English text. A prompt in another language matches a note only through the words that they share, such as names and code terms. "wie schreibe ich eine for-Schleife in TypeScript?" scores 0.52 against "How to write for loops in TypeScript.", because of "for" and "TypeScript". "hvordan deployer jeg nettbutikken?" scores 0.32 against "How to deploy the webshop." An English trigger does not help it (0.34). A trigger in the language of the user does help: "deploye nettbutikken" scores 0.73.

The small multilingual models need a SentencePiece tokenizer, which zambil does not have. So `src/measure/measure-embedders.ts` cannot compare one yet.

## Use it from another package

An adapter, such as `packages/claude-code`, loads the model once and then searches:

```ts
import { openNoteSearch } from "@zambil/embed/open-note-search";

const noteSearch = await openNoteSearch(environment, { report: console.error, download: "never" });
if (!noteSearch.ok) return noteSearch;
const result = await noteSearch.value.search(repo, {
  text: prompt,
  now: new Date(),
  unindexedLimit: 10,
});
```

`environment` is the `UserEnvironment` from `@zambil/core/locate-repo`, and `repo` comes from `loadRepo`. `result.value.matches` holds each matching note with its score. `report` gets a message before each download. With `download: "never"`, a model that is not in the cache is an error, and nothing is downloaded. `unindexedLimit` is the most descriptions and triggers that are not in the index to embed now. Without it, search embeds each one. `result.value.skipped` counts the texts that the limit left out. `noteSearch.value.index(repo)` does what `zambil index` does. `openNoteSearch` uses the model, the threshold and the cache folder that belong together, so a caller cannot mix them.

## How the model and the threshold were chosen

`measurements.md` holds the numbers. `src/measure/measure-embedders.ts` writes that file. The script compares nine small models on prose cases. Each case is a text that a user types, and the note that must match it. The notes are in `fixtures/prose-repo`. The cases are in four groups:

- 21 short texts must find one note. For example, "iterating" must find the note about for loops. 12 short texts must find none, for example "bake sourdough bread" and "what day is it". The note for today's date is expired, so "what day is it" must not match it.
- 20 task prompts are about one note each, as a user types them in an agent session. 15 task prompts and replies are about no note.
- 22 texts that must find a note and 15 that must find none. These were written after the threshold was chosen on the other groups, to see whether the choice holds on new texts. "iteration" and "iterating?" were added to them after the review.
- 32 texts that must find a note and 13 that must find none. They came with the growth of the repo from 20 to 50 notes. The first five are task prompts that missed their note in a review of zambil, for example "open a PR for this". Ten texts have more than one line. Seven are a paste, such as a log, a query or a function, then a question, a request or a reply. Three are a short task, then a side remark.

The threshold was chosen on the first three groups, 105 cases on 20 notes. These are the results of that time:

- A false match costs more than a miss, because the hook adds each match to the prompt. So the summary in `measurements.md` gives each model the threshold where the found notes minus 2 times the false matches is highest.
- The previous model, all-MiniLM-L6-v2, gives "iterating" the score 0.347. It puts the for-loops note first, but under its threshold of 0.42. At 0.42 it finds 23 of 63 notes with 2 false matches. To find "iterating", it needs 0.34, and it then gives 9 false matches.
- multi-qa-MiniLM-L6-cos-v1 gives "iterating" the score 0.388. At 0.38 it finds 32 of 63 notes with 3 false matches, "iterating" included. The previous model finds 32 at 0.38 too, but not "iterating".
- Both models have the same size and the same layers, so they take the same time. bge-small-en-v1.5 and gte-small are slower and give more false matches at their best thresholds.

So zambil uses multi-qa-MiniLM-L6-cos-v1 with the threshold 0.38, for `zambil search` and for the hook. 0.38 is the highest threshold that finds "iterating". The summary puts the best threshold of this model at 0.34: 41 found with 7 false matches. If a false match costs 2 misses, that is one point ahead of 0.38. If it costs 3 misses, 0.38 is ahead. The result is not clearly better, so zambil keeps the stricter threshold. A lower threshold for `zambil search` alone is possible, because the user reads its scores. It is not clearly better either, so search uses the same threshold.

The threshold is close to the score of "iterating". "iterate" (0.40) and "iterating over a list" (0.42) match, but "iteration" and "iterating?" do not. On the later cases, the model finds 12 of 22 notes with 3 false matches. All 3 false matches of the 105 cases are in that group. Each false match shares a word with the note, for example "Convert this JavaScript file to TypeScript" and "How to write for loops in TypeScript". The previous model at 0.42 finds 9 of the later notes with 2 false matches.

These rules were tried and rejected:

- If the best note scores at least 0.34 and leads the second note by 0.15, it matches. On the 61 match cases of that time, this rule found 33. But it gives false matches in a repo with fewer notes. When the right note is missing, the next note leads by a wide margin. A plain threshold does not depend on the other notes.
- Embedding the name or the start of the note with the description. It lowers the score of "iterating".
- Scoring each sentence of a long prompt and keeping the best score. It finds a few more notes and gives more false matches, and it embeds more texts.

### On 50 notes

The repo then grew to 50 notes. The 30 new notes are about other topics, such as on-call, backups and travel expenses. Their descriptions are short "How to" sentences, like the first 20. At 0.38, the search model now finds 52 of 95 notes with 21 false matches. The old cases find the same notes as before, but give 17 false matches in place of 3. In most of them, the note shares a word with the text. For example, "my branch is behind main" finds the note "How to name a git branch". The more notes a repo has, the more such pairs it has.

On 50 notes, the summary puts the best threshold of the search model at 0.41: 44 found with 12 false matches. zambil keeps 0.38 for now, for three reasons. 0.41 does not find "iterating". The review asked for more matches, not fewer. And a trigger gives a note scores of 0.6 to 0.9 for the prompts that are like it. If notes have triggers, a higher threshold costs less. No note of the prose repo has triggers yet, so this is not measured. Measure again before you change the threshold.

The new cases also show what zambil misses. Of the five prompts from the review, the search model finds two with the descriptions in this repo: on-call for "I got paged, grafana is red, what do I do", and auth for "the login endpoint returns 401 after a day, why?". The question after the pasted log misses, as [Index and search](#index-and-search) says.

"open a PR for this" and "add a dark mode toggle to the settings page" need a trigger.

The threshold comes from these cases and notes, so a new kind of note can need a new measurement. A prompt with more words than the topic, such as "iterating. Before you answer, quote the first line of any note", scores under the threshold.

The script times a model in a new Node process. A busy moment on the machine slows every model in the same way, because the runs go in rounds. Run the script again after you change the model, the tokenizer or the cases:

```sh
node packages/embed/src/measure/measure-embedders.ts
```

## No reranker

A reranker is a second model that reads the text and a note together and scores the pair. ms-marco-MiniLM-L-6-v2, quantized, was tried once on the 33 short texts with the transformers.js library. It put the right note first in 12 of 21 cases. At a threshold with no false match, it found 7 of 21 notes. It also added about 68 ms for each query. It is worse than the embedder alone, so zambil has no reranker.

## No background process

`measurements.md` times `zambil hook` at `UserPromptSubmit` from a cold start, as Claude Code runs it. A slash command, which loads the repo but not the model, takes about 35 ms. The similarity search adds about 70 ms for a short prompt. It adds about 100 ms for a prompt of 300 words. Loading the model is about 50 ms of that. A background process that keeps the model loaded saves that part on each prompt. The gain does not justify a process that the user must start and stop, so zambil has none.

## Tests

`pnpm test` runs the tests of this package with the rest of the repo:

- `src/search/search-notes.test.ts` is the prose test. It runs the cases with the real model and the threshold. If the count of found notes or the list of false matches changes, or if "iterating" no longer finds the for-loops note, the test fails.
- `apps/cli/src/search/search-command.test.ts` runs `zambil hook`, `zambil index`, `zambil search` and `zambil hook` again with an empty `XDG_CACHE_HOME`. So it downloads the model on each run, the same as a new machine.
- The other tests use a small fake embedder and need no model.

The tests need a connection to huggingface.co. The prose test keeps the model in your cache folder, so it downloads the model once. CI gets the model the same way: a CI machine starts with an empty cache, and the first test downloads the model.
