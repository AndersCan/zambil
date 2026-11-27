import { left, right } from "@zambil/core/either";
import type { Either } from "@zambil/core/either";

/** A longer word becomes one unknown token, as in BERT. */
const longestWord = 100;

const controlCharacter = /[\p{Cc}\p{Cf}]/u;
const combiningMark = /\p{Mn}/gu;
const punctuation = /[\p{P}!-/:-@[-`{-~]/u;
const whitespace = /\s/u;
const chineseCharacter =
  /[\u{4E00}-\u{9FFF}\u{3400}-\u{4DBF}\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{F900}-\u{FAFF}\u{2F800}-\u{2FA1F}]/u;

/** The ids of a lowercase BERT vocabulary, and the ids of its special tokens. */
export interface WordPieceVocabulary {
  ids: Map<string, number>;
  start: number;
  end: number;
  unknown: number;
}

/** Reads a `vocab.txt`: one token per line, and the line number is the id. */
export function parseVocabulary(text: string): Either<string, WordPieceVocabulary> {
  const ids = new Map<string, number>();
  for (const [line, token] of text.split("\n").entries()) {
    if (token !== "") ids.set(token, line);
  }
  const start = ids.get("[CLS]");
  const end = ids.get("[SEP]");
  const unknown = ids.get("[UNK]");
  const hasSpecialTokens = start !== undefined && end !== undefined && unknown !== undefined;
  if (!hasSpecialTokens) return left("the vocabulary has no [CLS], [SEP] or [UNK] token");
  return right({ ids, start, end, unknown });
}

function isSkipped(character: string): boolean {
  const isLineBreakOrTab = "\t\n\r".includes(character);
  if (isLineBreakOrTab) return false;
  return character === "\0" || character === "�" || controlCharacter.test(character);
}

function splitWords(text: string): string[] {
  const words: string[] = [];
  let word = "";
  for (const character of text) {
    if (isSkipped(character)) continue;
    const standsAlone = punctuation.test(character) || chineseCharacter.test(character);
    if (whitespace.test(character) || standsAlone) {
      if (word !== "") words.push(word);
      word = "";
    }
    if (standsAlone) words.push(character);
    else if (!whitespace.test(character)) word += character;
  }
  if (word !== "") words.push(word);
  return words;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replaceAll(combiningMark, "");
}

function characterBoundaries(word: string): number[] {
  const boundaries = [0];
  let offset = 0;
  for (const character of word) {
    offset += character.length;
    boundaries.push(offset);
  }
  return boundaries;
}

function splitWord(word: string, vocabulary: WordPieceVocabulary): number[] {
  const boundaries = characterBoundaries(word);
  const characterCount = boundaries.length - 1;
  if (characterCount > longestWord) return [vocabulary.unknown];
  const pieces: number[] = [];
  let start = 0;
  while (start < characterCount) {
    let end = characterCount;
    let found: number | undefined;
    while (end > start && found === undefined) {
      const piece = word.slice(boundaries[start], boundaries[end]);
      found = vocabulary.ids.get(start === 0 ? piece : `##${piece}`);
      if (found === undefined) end -= 1;
    }
    if (found === undefined) return [vocabulary.unknown];
    pieces.push(found);
    start = end;
  }
  return pieces;
}

/** The vocabulary, and the most tokens the model reads, with the start and end tokens. */
export interface TokenizeOptions {
  vocabulary: WordPieceVocabulary;
  maxTokens: number;
}

/**
 * How many characters of a text to read for each token that the model reads. A token is rarely longer
 * than a word, so the cut keeps every token that the model reads, and a pasted file of megabytes is not
 * lowercased in full.
 */
const charactersPerToken = 100;

/**
 * Turns a text into token ids the way a lowercase BERT tokenizer does: it lowercases, strips accents,
 * splits on spaces and punctuation, splits each word into the longest known pieces, and adds the start
 * and end tokens. A text that is too long is cut at the end.
 */
export function tokenize(text: string, options: TokenizeOptions): number[] {
  const { vocabulary, maxTokens } = options;
  const ids: number[] = [];
  const readable = text.slice(0, maxTokens * charactersPerToken);
  for (const word of splitWords(normalize(readable))) {
    ids.push(...splitWord(word, vocabulary));
    if (ids.length >= maxTokens - 2) break;
  }
  return [vocabulary.start, ...ids.slice(0, maxTokens - 2), vocabulary.end];
}
