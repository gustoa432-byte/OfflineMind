export interface KnowledgeEntry {
  id: string;
  canonicalTitle: string;
  category: 'arithmetic' | 'geometry' | 'units_length' | 'units_area' | 'units_mass' | 'units_volume' | 'units_time_speed';
  categoryNameRu: string;
  definition: string;
  simpleExplanation: string;
  examples: string[];
  relatedConcepts: string[];
  doNotConfuseWith?: {
    term: string;
    difference: string;
  };
  formulas?: string[];
  conversionFactors?: { unit: string; ratio: string }[];
  commonMisconceptions?: string[];
  source: string;
  verificationDate: string;
  keywords: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  tag: string;
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  format: 'GGUF Q4_K_M';
  parameters: string;
  contextLength: number;
  expectedRamMb: number;
  sha256: string;
  downloadUrl: string;
  recommendedForDevice: boolean;
  notes: string;
}

export type ModelInstallStatus =
  | 'not_installed'
  | 'checking_space'
  | 'downloading'
  | 'paused'
  | 'verifying_checksum'
  | 'moving_to_storage'
  | 'warming_engine'
  | 'running_test_query'
  | 'ready'
  | 'error';

export interface ModelInstallProgress {
  status: ModelInstallStatus;
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  timeRemainingSec: number;
  currentStepDescription: string;
  errorMessage?: string;
  testQueryOutput?: string;
}

export interface InferenceMetrics {
  ttftMs: number;
  totalTimeMs: number;
  tokensGenerated: number;
  tokensPerSec: number;
  wordsPerMinute: number;
  memoryRssMb: number;
  peakMemoryMb: number;
}

export interface QueryHistoryItem {
  id: string;
  timestamp: number;
  query: string;
  matchedEntryId?: string;
  matchedEntryTitle?: string;
  isVerifiedKnowledge: boolean;
  answerText: string;
  metrics: InferenceMetrics;
  isFavorite: boolean;
  followUpQuestions?: string[];
}

export interface BenchmarkTestResult {
  questionId: string;
  question: string;
  category: string;
  expectedAnswerSubstring: string;
  actualAnswer: string;
  passed: boolean;
  ttftMs: number;
  generationTimeMs: number;
  tokensPerSec: number;
  wordsPerMinute: number;
  memoryRssMb: number;
}

export interface DeviceSpec {
  manufacturer: string;
  model: string;
  os: string;
  osShell: string;
  soc: string;
  physicalRamGb: number;
  ramTurboGb: number;
  storageTotalGb: number;
  storageFreeGb: number;
  abi: string;
}
