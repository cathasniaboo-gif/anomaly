import { KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { KnowledgeItem } from '../types';

// Lightweight local answer-matching engine for the "Ask a consultant" screen.
//
// This is a keyword/overlap scorer over the bundled knowledge base — it runs
// fully on-device with no network call, so it works offline and never sends
// a user's question anywhere. It is deliberately not a general-purpose LLM:
// treat AskEngine as the retrieval layer. To add real generative answers,
// swap `answerQuestion` for a call to a hosted model (see README.md,
// "Connecting a real language model").

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'i',
  'my', 'me', 'we', 'our', 'you', 'your', 'it', 'its', 'in', 'on', 'at',
  'to', 'for', 'of', 'and', 'or', 'if', 'what', 'when', 'where', 'who',
  'how', 'why', 'which', 'can', 'could', 'should', 'would', 'will', 'be',
  'this', 'that', 'these', 'those', 'as', 'with', 'about', 'have', 'has',
  'need', 'needs', 'much', 'many',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%+.\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface MatchResult {
  item: KnowledgeItem;
  score: number;
}

const CORPUS = KNOWLEDGE_BASE.map((item) => {
  const haystack = [item.q, item.a, item.cat, ...(item.keywords ?? [])].join(' ');
  return { item, tokens: new Set(tokenize(haystack)) };
});

export function matchQuestion(question: string, limit = 5): MatchResult[] {
  const qTokens = tokenize(question);
  if (qTokens.length === 0) return [];

  const scored: MatchResult[] = CORPUS.map(({ item, tokens }) => {
    let score = 0;
    for (const t of qTokens) {
      if (tokens.has(t)) score += 2;
      else {
        // partial / substring credit for close acronym or prefix matches
        for (const ht of tokens) {
          if (ht.length > 3 && (ht.startsWith(t) || t.startsWith(ht))) {
            score += 0.5;
            break;
          }
        }
      }
    }
    // small boost for keyword field hits (curated high-signal terms)
    for (const kw of item.keywords ?? []) {
      if (question.toLowerCase().includes(kw.toLowerCase())) score += 1.5;
    }
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface ConsultantAnswer {
  best: KnowledgeItem | null;
  alternatives: KnowledgeItem[];
  confident: boolean;
}

export function answerQuestion(question: string): ConsultantAnswer {
  const matches = matchQuestion(question, 4);
  if (matches.length === 0) {
    return { best: null, alternatives: [], confident: false };
  }
  const [top, ...rest] = matches;
  // Confident only when the top match clearly separates from the runner-up.
  const confident = top.score >= 3 && (rest.length === 0 || top.score > rest[0].score * 1.15);
  return {
    best: top.item,
    alternatives: rest.map((m) => m.item),
    confident,
  };
}

export const SUGGESTED_QUESTIONS = [
  'What is the corporate tax rate?',
  'What is a QFZP and how do I qualify?',
  'What is the DMTT and who does it apply to?',
  'Do I still need to file ESR reports?',
  'How is end-of-service gratuity calculated?',
  'What is the UAE VAT rate?',
  'When does IFRS 18 become mandatory?',
];
