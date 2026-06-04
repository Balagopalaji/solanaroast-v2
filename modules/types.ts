import type { Transaction } from "@solana/web3.js";

export type TargetType = "wallet" | "token" | "twitter";

export type MemeTemplateId =
  | "this-is-fine"
  | "distracted-bf"
  | "stonks"
  | "not-stonks"
  | "coffin-dance"
  | "drake-no-yes"
  | "galaxy-brain"
  | "wojak-crying"
  | "nft-guy"
  | "wen-moon"
  | "surprised-pikachu"
  | "harold-pain"
  | "two-buttons"
  | "doge";

export interface MemeTemplate {
  id: MemeTemplateId;
  name: string;
  description: string;
}

export interface RoastTargetData {
  targetType: TargetType;
  input: string;
  displayName: string;
  facts: RoastFact[];
  rawData: unknown;
}

export interface RoastFact {
  label: string;
  value: string;
  roastable: boolean;
  roastHint?: string;
}

export interface PromptInput {
  targetType: TargetType;
  facts: RoastFact[];
  displayName: string;
  templates: MemeTemplate[];
  fewShotExamples?: string[];
}

export interface RoastOutput {
  roast: string;
  template: MemeTemplateId;
  templateReason: string;
}

export interface CachedRoast {
  roastId: string;
  targetType: TargetType;
  input: string;
  roast: string;
  template: MemeTemplateId;
  targetSnapshot: RoastTargetData;
  generatedAt: number;
  upvotes: number;
  downvotes: number;
}

export interface DataModule {
  targetType: TargetType;
  validate(input: string): boolean;
  fetchData(input: string): Promise<RoastTargetData>;
}

export interface AIModule {
  generateRoast(prompt: PromptInput): Promise<RoastOutput>;
}

export interface ImageModule {
  render(templateId: MemeTemplateId, roastText: string): Promise<Blob>;
}

export interface OGModule {
  generate(roast: CachedRoast): Promise<Response>;
}

export interface CacheModule {
  get(key: string): Promise<CachedRoast | null>;
  set(key: string, value: CachedRoast, ttlSeconds: number): Promise<void>;
  incrementHits(key: string): Promise<void>;
}

export interface RateLimitModule {
  check(identifier: string): Promise<{ allowed: boolean; remaining: number }>;
}

export interface PaymentModule {
  createTransaction(
    amountSOL: number,
    recipient: string,
  ): Promise<Transaction>;
  confirm(signature: string): Promise<boolean>;
}
