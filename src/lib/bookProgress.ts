export type BookFormat = 'book' | 'novella';

export const BOOK_FORMATS: Record<BookFormat, {
  label: string;
  description: string;
  targetWords: number;
  chapterCount: number;
  pageEstimate: string;
  subscriptionMonths: number;
  callsNeeded: number;
  priceMonthly: number;
  pricePrintedCopy: number;
}> = {
  book: {
    label: 'Täysi elämäntarinakirja',
    description: 'Kattava 200-sivuinen kovakantinen teos. 15 lukua, noin 50 000 sanaa. Sopii kokonaisen elämän taltiointiin.',
    targetWords: 50000,
    chapterCount: 15,
    pageEstimate: '~200 sivua',
    subscriptionMonths: 12,
    callsNeeded: 90,
    priceMonthly: 39,
    pricePrintedCopy: 149,
  },
  novella: {
    label: 'Novellimuotoinen elämäntarina',
    description: 'Tiivis 50–60-sivuinen pehmeäkantinen vihkoteos. 8 valittua lukua, noin 12 000 sanaa. Sopii lyhyempään tilaukseen tai kiireellisempiin tilanteisiin.',
    targetWords: 12000,
    chapterCount: 8,
    pageEstimate: '~50 sivua',
    subscriptionMonths: 6,
    callsNeeded: 24,
    priceMonthly: 29,
    pricePrintedCopy: 89,
  },
};

export const NOVELLA_STAGES = [
  'lapsuus', 'vanhemmat', 'nuoruus', 'kotoa_lahto',
  'tyo', 'parisuhde', 'lasten_synty', 'arvot',
];

export const STATUS_WEIGHT: Record<string, number> = {
  empty: 0,
  draft: 0.4,
  reviewed: 0.8,
  final: 1.0,
};

type Chapter = {
  life_stage: string;
  word_count: number;
  target_word_count: number;
  status: string;
  included_in_novella: boolean;
};

type CoverageRow = {
  life_stage: string;
  depth_score: number;
  status: string;
};

export interface BookProgress {
  overallPercent: number;
  wordsPercent: number;
  statusPercent: number;
  coveragePercent: number;
  totalWords: number;
  targetWords: number;
  chaptersReady: number;
  chaptersInProgress: number;
  chaptersTotal: number;
  estimatedCallsNeeded: number;
  estimatedWeeksNeeded: number;
  format: BookFormat;
}

export function calculateBookProgress(
  chapters: Chapter[],
  coverageMap: CoverageRow[],
  format: BookFormat = 'book'
): BookProgress {
  const relevantChapters = format === 'novella'
    ? chapters.filter(c => c.included_in_novella)
    : chapters;

  const chaptersTotal = relevantChapters.length || BOOK_FORMATS[format].chapterCount;

  const totalWords = relevantChapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const targetWords = format === 'novella'
    ? BOOK_FORMATS.novella.targetWords
    : (relevantChapters.reduce((sum, c) => sum + (c.target_word_count || 3300), 0) || BOOK_FORMATS.book.targetWords);

  const wordsPercent = Math.min(100, (totalWords / targetWords) * 100);

  const statusSum = relevantChapters.reduce(
    (sum, c) => sum + (STATUS_WEIGHT[c.status] || 0),
    0
  );
  const statusPercent = chaptersTotal > 0
    ? (statusSum / chaptersTotal) * 100
    : 0;

  const relevantStages = relevantChapters.map(c => c.life_stage);
  const relevantCoverage = coverageMap.filter(c => relevantStages.includes(c.life_stage));
  const coverageAverage = relevantCoverage.length > 0
    ? relevantCoverage.reduce((sum, c) => sum + (c.depth_score || 0), 0) / relevantCoverage.length
    : 0;
  const coveragePercent = coverageAverage;

  const overallPercent = Math.round(
    wordsPercent * 0.5 + statusPercent * 0.3 + coveragePercent * 0.2
  );

  const chaptersReady = relevantChapters.filter(
    (c) => c.status === 'reviewed' || c.status === 'final'
  ).length;
  const chaptersInProgress = relevantChapters.filter((c) => c.status === 'draft').length;

  const wordsRemaining = Math.max(0, targetWords - totalWords);
  const avgWordsPerCall = format === 'novella' ? 500 : 550;
  const estimatedCallsNeeded = Math.ceil(wordsRemaining / avgWordsPerCall);
  const callsPerWeek = 1.5;
  const estimatedWeeksNeeded = Math.ceil(estimatedCallsNeeded / callsPerWeek);

  return {
    overallPercent,
    wordsPercent: Math.round(wordsPercent),
    statusPercent: Math.round(statusPercent),
    coveragePercent: Math.round(coveragePercent),
    totalWords,
    targetWords,
    chaptersReady,
    chaptersInProgress,
    chaptersTotal,
    estimatedCallsNeeded,
    estimatedWeeksNeeded,
    format,
  };
}

export function formatProgressDescription(progress: BookProgress): string {
  const formatLabel = progress.format === 'novella' ? 'Novelli' : 'Kirja';

  if (progress.overallPercent < 5) {
    return `${formatLabel} on juuri aloitettu — useimmat aiheet odottavat käsittelyä.`;
  }
  if (progress.overallPercent < 25) {
    return `${formatLabel} on alkuvaiheessa. Noin ${progress.estimatedCallsNeeded} puhelua tarvitaan vielä, arviolta ${progress.estimatedWeeksNeeded} viikkoa.`;
  }
  if (progress.overallPercent < 50) {
    return `${formatLabel} on muotoutumassa. Puolivälissä noin ${progress.estimatedCallsNeeded} puhelun päässä.`;
  }
  if (progress.overallPercent < 75) {
    return `${formatLabel} on pitkälle muotoutunut. Viimeistelyyn tarvitaan vielä noin ${progress.estimatedCallsNeeded} puhelua.`;
  }
  if (progress.overallPercent < 95) {
    return `${formatLabel} on lähes valmis. Enää muutama puhelu ja viimeistely.`;
  }
  return `${formatLabel} on valmis painoon.`;
}
