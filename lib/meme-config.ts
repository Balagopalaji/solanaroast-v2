import type { MemeTemplateId } from "@/modules/types";

export interface MemeTextArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MemeFontConfig {
  family: string;
  maxSize: number;
  minSize: number;
  lineHeight: number;
  weight: number;
}

export interface MemeTemplateConfig {
  canvas: {
    width: number;
    height: number;
  };
  textArea: MemeTextArea;
  font: MemeFontConfig;
  color: string;
  strokeColor: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}

const defaultFont: MemeFontConfig = {
  family: "Impact, Arial Black, Arial, sans-serif",
  maxSize: 68,
  minSize: 28,
  lineHeight: 1.05,
  weight: 900,
};

const standardCanvas = {
  width: 1200,
  height: 900,
} as const;

export const memeConfig: Record<MemeTemplateId, MemeTemplateConfig> = {
  "this-is-fine": {
    canvas: standardCanvas,
    textArea: { x: 96, y: 80, width: 1008, height: 196 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "distracted-bf": {
    canvas: standardCanvas,
    textArea: { x: 72, y: 48, width: 1056, height: 180 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  stonks: {
    canvas: standardCanvas,
    textArea: { x: 84, y: 626, width: 1032, height: 198 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "not-stonks": {
    canvas: standardCanvas,
    textArea: { x: 84, y: 622, width: 1032, height: 202 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "coffin-dance": {
    canvas: standardCanvas,
    textArea: { x: 80, y: 52, width: 1040, height: 190 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "drake-no-yes": {
    canvas: standardCanvas,
    textArea: { x: 600, y: 92, width: 520, height: 708 },
    font: { ...defaultFont, maxSize: 58, minSize: 24 },
    color: "#111111",
    strokeColor: "#ffffff",
    align: "center",
    baseline: "middle",
  },
  "galaxy-brain": {
    canvas: standardCanvas,
    textArea: { x: 54, y: 52, width: 520, height: 796 },
    font: { ...defaultFont, maxSize: 52, minSize: 22 },
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "middle",
  },
  "wojak-crying": {
    canvas: standardCanvas,
    textArea: { x: 80, y: 620, width: 1040, height: 200 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "nft-guy": {
    canvas: standardCanvas,
    textArea: { x: 82, y: 70, width: 1036, height: 186 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "wen-moon": {
    canvas: standardCanvas,
    textArea: { x: 72, y: 608, width: 1056, height: 212 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "surprised-pikachu": {
    canvas: standardCanvas,
    textArea: { x: 72, y: 52, width: 1056, height: 190 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "harold-pain": {
    canvas: standardCanvas,
    textArea: { x: 78, y: 620, width: 1044, height: 204 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  "two-buttons": {
    canvas: standardCanvas,
    textArea: { x: 84, y: 56, width: 1032, height: 190 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
  doge: {
    canvas: standardCanvas,
    textArea: { x: 80, y: 620, width: 1040, height: 204 },
    font: defaultFont,
    color: "#ffffff",
    strokeColor: "#111111",
    align: "center",
    baseline: "top",
  },
};

export const memeTemplateIds = Object.keys(memeConfig) as MemeTemplateId[];

export const memeWatermark = "AI satire · solanaroast.lol";
