# @zambil/embed

Similarity search for zambil. An embedder is a model that turns a text into a vector, so that texts with a similar meaning get vectors that are close. This package matches a text, such as a prompt, against the `description` of each note. It runs the model on your machine with ONNX Runtime.

The `zambil index` and `zambil search <text>` commands in `apps/cli` use it.

## The model

zambil uses all-MiniLM-L6-v2, quantized to 8 bits (23 MB), from the `Xenova/all-MiniLM-L6-v2` repo on Hugging Face. `src/model/search-model.ts` pins the commit and the size and SHA-256 of each file.

zambil downloads the model the first time that it needs it. It does not use a model that is already on the machine. The files go to `$XDG_CACHE_HOME/zambil/models/`. If `XDG_CACHE_HOME` is not set, the folder is `~/.cache/zambil/models/`. A download is written to a temporary file first. zambil gives it its final name only after the size and the SHA-256 match the pins. So a file in the cache is always complete. If a download fails, the command stops with an error and keeps no file.

ONNX Runtime also writes a small `Microsoft/DeveloperTools` folder in `$XDG_CACHE_HOME`, outside the `zambil` folder.

The `onnxruntime-node` package has prebuilt binaries for Linux (x64, arm64), macOS (arm64) and Windows. Its install script only adds GPU support, so `pnpm-workspace.yaml` skips that script.

## Index and search

`zambil index` embeds the description of every note and writes the vectors to `$XDG_CACHE_HOME/zambil/index/<hash of the repo path>.json`. It never writes to the repo. A second run embeds only the descriptions that changed.

`zambil search` loads the repo, leaves out each expired note, and scores the description of each other note against the text. The score is the cosine similarity, from -1 to 1. It returns at most 3 notes that score 0.42 or more, best first. It checks expiry each time it runs, never in the index, so a note that expires after `zambil index` is left out at once. If a description is not in the index, search embeds it at query time. The result is the same, only slower, and the command tells you to run `zambil index`.

The model embeds one text at a time. The 8-bit model scales its numbers over a whole batch, so a text in a batch of 16 gets a vector that differs by up to 0.035 in score. One text at a time gives each description one vector, with or without an index.

## Use it from another package

An adapter, such as the later Claude Code adapter, loads the model once and then searches:

```ts
import { openNoteSearch } from "@zambil/embed/open-note-search";

const noteSearch = await openNoteSearch(environment, { report: console.error });
if (!noteSearch.ok) return noteSearch;
const result = await noteSearch.value.search(repo, { text: prompt, now: new Date() });
```

`environment` is the `UserEnvironment` from `@zambil/core/locate-repo`, and `repo` comes from `loadRepo`. `result.value.matches` holds each matching note with its score. `report` gets a message before each download. `noteSearch.value.index(repo)` does what `zambil index` does. `openNoteSearch` uses the model, the threshold and the cache folder that belong together, so a caller cannot mix them.

## How the model was chosen

`measurements.md` holds the numbers. `src/measure/measure-embedders.ts` writes that file. The script compares seven small models on prose cases. Each case is a text that a user types, and the note that must match it. 21 cases must find one note, for example "iterating" must find the note about for loops. 12 cases must find no note, for example "bake sourdough bread" and "what day is it". The note for today's date is expired, so "what day is it" must not match it.

These are the results:

- bge-small-en-v1.5 puts the right note first in 21 of 21 cases, and all-MiniLM-L6-v2 in 20 of 21.
- A false match costs more than a miss, because the next step adds each match to every prompt. So the threshold must be above the score of every wrong note. At that threshold, all-MiniLM-L6-v2 finds 9 of 21 notes, and bge-small-en-v1.5 finds 12 of 21.
- all-MiniLM-L6-v2 is faster. It loads in 53 ms, against 82 ms. A 300-word prompt takes 21 ms, against 80 ms.
- The 32-bit version of all-MiniLM-L6-v2 gives the same scores. It is four times as large and loads more slowly.

zambil uses all-MiniLM-L6-v2. bge-small-en-v1.5 finds more notes, but the difference is 3 cases out of 21. When a better result is not clear, speed wins. The highest score of a wrong note is 0.402, for the migrations note on "where do I keep the database password". The threshold is 0.42, one step of 0.01 above the lowest safe value, 0.41. It finds the same 9 notes as 0.41 and keeps a small margin. "iterating" puts the for-loops note first, but its score is 0.347, so it is a miss. The threshold comes from 33 cases, so a new kind of note can need a new measurement.

The script times a model in a new Node process. A busy moment on the machine slows every model in the same way, because the runs go in rounds. Run the script again after you change the model, the tokenizer or the cases:

```sh
node packages/embed/src/measure/measure-embedders.ts
```

## No reranker

A reranker is a second model that reads the text and a note together and scores the pair. ms-marco-MiniLM-L-6-v2, quantized, was tried once on the same cases with the transformers.js library. It put the right note first in 12 of 21 cases. At a threshold with no false match, it found 7 of 21 notes. It also added about 68 ms for each query. It is worse than the embedder alone, so zambil has no reranker.

## No background process

The whole `zambil search` command takes 149 ms, from the start of the process to its exit. Loading the model is 53 ms of that, and embedding one query is 5 ms or less. A background process that keeps the model loaded saves the model load, about 50 ms, for each prompt. That gain does not justify a process that the user must start and stop. If the Claude Code adapter turns out to be too slow on each prompt, measure it again before you add one.

## Tests

`pnpm test` runs the tests of this package with the rest of the repo:

- `src/search/search-notes.test.ts` is the prose test. It runs the cases with the real model and the threshold. If a case finds a wrong note, or if the set of found notes changes, the test fails.
- `apps/cli/src/search/search-command.test.ts` runs `zambil index` and `zambil search` with an empty `XDG_CACHE_HOME`. So it downloads the model on each run, the same as a new machine.
- The other tests use a small fake embedder and need no model.

The tests need a connection to huggingface.co. The prose test keeps the model in your cache folder, so it downloads the model once. CI gets the model the same way: a CI machine starts with an empty cache, and the first test downloads the model.
