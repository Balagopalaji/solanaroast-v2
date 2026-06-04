import type { AIModule, DataModule, TargetType } from "./types";

export const dataModules: Partial<Record<TargetType, DataModule>> = {};

export const ai: AIModule | null = null;
