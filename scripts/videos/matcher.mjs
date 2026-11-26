// The learned matcher guesses a category for a title the keyword rules missed, using the titles of
// videos that are already sorted. It answers only when it is confident; otherwise it returns null.
import { normalize } from './categorize.mjs';

const TELUGU = /\p{Script=Telugu}/u;
const STEM_LENGTH = 4;
const SERIES_MIN_WORDS = 2;
const SERIES_MIN_EXAMPLES = 2;

const words = (text) => normalize(text).split(' ').filter((word) => word && !/\d/.test(word));

// Telugu words change their endings (ఆదివారం, ఆదివారపు), so the first few letters count too.
const stem = (word) => {
  const letters = [...word];
  return TELUGU.test(word) && letters.length > STEM_LENGTH ? `${letters.slice(0, STEM_LENGTH).join('')}~` : null;
};

/** The words of a title (without numbers) and the stems of its longer Telugu words. */
export function titleTokens(title) {
  const tokens = new Set();
  for (const word of words(title)) {
    tokens.add(word);
    const short = stem(word);
    if (short) tokens.add(short);
  }
  return [...tokens];
}

/**
 * The parts of a title between "||", "|" or "_" separators, without numbers, that are long enough to
 * name a series, such as "telugu christian short message".
 */
export function seriesKeys(title) {
  const keys = new Set();
  for (const part of String(title ?? '').split(/[|_]+/)) {
    const partWords = words(part);
    if (partWords.filter((word) => [...word].length >= 3).length >= SERIES_MIN_WORDS) keys.add(partWords.join(' '));
  }
  return [...keys];
}

/**
 * Learns from examples ({ title, category }) and returns match(title), which gives
 * { category, confidence, via: 'series' | 'words' } or null when unsure.
 * A series match (a title part shared with at least two earlier videos, all in one category) may give
 * any category. A word match only gives one of wordCategories when that is set, because the words
 * of a message say what it is about but not who preached it.
 */
export function createMatcher(examples, { minConfidence = 0.9, minKnownWords = 2, wordCategories } = {}) {
  const wordAllowed = wordCategories ? new Set(wordCategories) : null;
  const series = new Map();
  const documents = new Map();
  const counts = new Map();
  const totals = new Map();
  const vocabulary = new Set();
  for (const { title, category } of examples) {
    for (const key of seriesKeys(title)) {
      if (!series.has(key)) series.set(key, new Map());
      series.get(key).set(category, (series.get(key).get(category) ?? 0) + 1);
    }
    documents.set(category, (documents.get(category) ?? 0) + 1);
    if (!counts.has(category)) counts.set(category, new Map());
    for (const token of titleTokens(title)) {
      counts.get(category).set(token, (counts.get(category).get(token) ?? 0) + 1);
      totals.set(category, (totals.get(category) ?? 0) + 1);
      vocabulary.add(token);
    }
  }
  const categories = [...documents.keys()];

  function bySeries(title) {
    const votes = new Set();
    for (const key of seriesKeys(title)) {
      const seen = series.get(key);
      if (!seen || seen.size !== 1) continue;
      const [[category, count]] = seen;
      if (count >= SERIES_MIN_EXAMPLES) votes.add(category);
    }
    return votes.size === 1 ? { category: [...votes][0], confidence: 1, via: 'series' } : null;
  }

  function byWords(title) {
    const known = words(title).filter((word) => vocabulary.has(word) || vocabulary.has(stem(word)));
    if (categories.length < 2 || known.length < minKnownWords) return null;
    const tokens = titleTokens(title).filter((token) => vocabulary.has(token));
    const scores = categories.map((category) => {
      let score = Math.log(documents.get(category) / examples.length);
      for (const token of tokens) {
        score += Math.log(((counts.get(category).get(token) ?? 0) + 1) / ((totals.get(category) ?? 0) + vocabulary.size));
      }
      return score;
    });
    const best = Math.max(...scores);
    const sum = scores.reduce((total, score) => total + Math.exp(score - best), 0);
    const index = scores.indexOf(best);
    const confidence = 1 / sum;
    if (confidence < minConfidence || (wordAllowed && !wordAllowed.has(categories[index]))) return null;
    return { category: categories[index], confidence, via: 'words' };
  }

  return {
    size: examples.length,
    categories,
    match: (title) => bySeries(title) ?? byWords(title),
  };
}

/**
 * Leave-one-out check: each example is guessed by a matcher trained on all the others.
 * precision = right answers / answers, coverage = answers / examples.
 */
export function evaluateMatcher(examples, options) {
  let answered = 0;
  let correct = 0;
  const mistakes = [];
  examples.forEach((example, index) => {
    const result = createMatcher(examples.filter((_, other) => other !== index), options).match(example.title);
    if (!result) return;
    answered++;
    if (result.category === example.category) correct++;
    else mistakes.push({ title: example.title, expected: example.category, got: result.category, via: result.via });
  });
  return {
    examples: examples.length,
    answered,
    correct,
    precision: answered ? correct / answered : 1,
    coverage: examples.length ? answered / examples.length : 0,
    mistakes,
  };
}
