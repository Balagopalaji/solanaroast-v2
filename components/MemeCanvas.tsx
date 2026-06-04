"use client";

import { useEffect, useRef } from "react";
import { memeConfig, memeWatermark } from "@/lib/meme-config";
import type { MemeTemplateConfig } from "@/lib/meme-config";
import type { MemeTemplateId } from "@/modules/types";

interface MemeCanvasProps {
  templateId: MemeTemplateId;
  roastText: string;
  className?: string;
  ariaLabel?: string;
}

const WATERMARK_FONT = "600 22px Arial, sans-serif";
const WATERMARK_PADDING = 22;
const TEXT_PADDING = 18;

export default function MemeCanvas({
  templateId,
  roastText,
  className,
  ariaLabel = "Generated SolanaRoast meme",
}: MemeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const config = memeConfig[templateId];
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let cancelled = false;
    const image = new Image();

    const draw = (sourceImage?: HTMLImageElement) => {
      if (cancelled) {
        return;
      }

      drawBase(context, config, templateId, sourceImage);
      drawRoastText(context, config, roastText);
      drawWatermark(context, config);
    };

    canvas.width = config.canvas.width;
    canvas.height = config.canvas.height;
    draw();

    image.onload = () => draw(image);
    image.onerror = () => draw();
    image.src = `/memes/${templateId}.jpg`;

    return () => {
      cancelled = true;
    };
  }, [roastText, templateId]);

  const config = memeConfig[templateId];

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label={ariaLabel}
      role="img"
      width={config.canvas.width}
      height={config.canvas.height}
      style={{
        aspectRatio: `${config.canvas.width} / ${config.canvas.height}`,
        display: "block",
        height: "auto",
        maxWidth: "100%",
        width: "100%",
      }}
    />
  );
}

function drawBase(
  context: CanvasRenderingContext2D,
  config: MemeTemplateConfig,
  templateId: MemeTemplateId,
  sourceImage?: HTMLImageElement,
) {
  const { width, height } = config.canvas;
  context.clearRect(0, 0, width, height);

  if (sourceImage) {
    drawCoverImage(context, sourceImage, width, height);
    return;
  }

  context.fillStyle = "#101214";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#20252b";
  context.fillRect(36, 36, width - 72, height - 72);
  context.strokeStyle = "#6b7280";
  context.lineWidth = 6;
  context.strokeRect(54, 54, width - 108, height - 108);

  context.fillStyle = "#f4f4f5";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 42px Arial, sans-serif";
  context.fillText("Meme template unavailable", width / 2, height / 2 - 34);
  context.font = "500 28px Arial, sans-serif";
  context.fillText(`/memes/${templateId}.jpg`, width / 2, height / 2 + 22);
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const sourceWidth = targetWidth / scale;
  const sourceHeight = targetHeight / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
}

function drawRoastText(
  context: CanvasRenderingContext2D,
  config: MemeTemplateConfig,
  roastText: string,
) {
  const text = normalizeText(roastText);
  const { textArea, font, color, strokeColor } = config;
  const maxWidth = textArea.width - TEXT_PADDING * 2;
  const maxHeight = textArea.height - TEXT_PADDING * 2;

  const layout = fitText(context, text, config, maxWidth, maxHeight);
  const lineHeight = layout.fontSize * font.lineHeight;
  const blockHeight = layout.lines.length * lineHeight;
  const startY =
    config.baseline === "middle"
      ? textArea.y + textArea.height / 2 - blockHeight / 2 + lineHeight / 2
      : textArea.y + TEXT_PADDING;
  const x = textArea.x + textArea.width / 2;

  context.textAlign = config.align;
  context.textBaseline = config.baseline;
  context.font = fontDeclaration(config, layout.fontSize);
  context.lineJoin = "round";
  context.miterLimit = 2;
  context.strokeStyle = strokeColor;
  context.fillStyle = color;
  context.lineWidth = Math.max(5, layout.fontSize * 0.11);

  layout.lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    context.strokeText(line, x, y, maxWidth);
    context.fillText(line, x, y, maxWidth);
  });
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  config: MemeTemplateConfig,
  maxWidth: number,
  maxHeight: number,
) {
  for (
    let fontSize = config.font.maxSize;
    fontSize >= config.font.minSize;
    fontSize -= 2
  ) {
    context.font = fontDeclaration(config, fontSize);
    const lines = wrapText(context, text, maxWidth);
    if (lines.length * fontSize * config.font.lineHeight <= maxHeight) {
      return { fontSize, lines };
    }
  }

  context.font = fontDeclaration(config, config.font.minSize);
  return {
    fontSize: config.font.minSize,
    lines: clampLines(
      wrapText(context, text, maxWidth),
      Math.max(1, Math.floor(maxHeight / (config.font.minSize * config.font.lineHeight))),
    ),
  };
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }

      if (line) {
        lines.push(line);
      }

      if (context.measureText(word).width <= maxWidth) {
        line = word;
        return;
      }

      const wordLines = breakLongWord(context, word, maxWidth);
      lines.push(...wordLines.slice(0, -1));
      line = wordLines[wordLines.length - 1] ?? "";
    });

    if (line) {
      lines.push(line);
    }
  });

  return lines;
}

function breakLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let fitting = "";

  for (const character of word) {
    if (context.measureText(`${fitting}${character}`).width > maxWidth) {
      if (fitting) {
        lines.push(fitting);
        fitting = character;
        continue;
      }

      lines.push(character);
      fitting = "";
      continue;
    }

    fitting += character;
  }

  if (fitting) {
    lines.push(fitting);
  }

  return lines;
}

function clampLines(lines: string[], maxLines: number) {
  if (lines.length <= maxLines) {
    return lines;
  }

  const clamped = lines.slice(0, maxLines);
  const lastLine = clamped[clamped.length - 1] ?? "";
  clamped[clamped.length - 1] =
    lastLine.length > 1 ? `${lastLine.slice(0, -1)}...` : "...";
  return clamped;
}

function drawWatermark(
  context: CanvasRenderingContext2D,
  config: MemeTemplateConfig,
) {
  const { width, height } = config.canvas;
  context.save();
  context.font = WATERMARK_FONT;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.lineWidth = 4;
  context.strokeStyle = "rgba(0, 0, 0, 0.75)";
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.strokeText(
    memeWatermark,
    width - WATERMARK_PADDING,
    height - WATERMARK_PADDING,
  );
  context.fillText(
    memeWatermark,
    width - WATERMARK_PADDING,
    height - WATERMARK_PADDING,
  );
  context.restore();
}

function fontDeclaration(config: MemeTemplateConfig, size: number) {
  return `${config.font.weight} ${size}px ${config.font.family}`;
}

function normalizeText(text: string) {
  const trimmed = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return trimmed || "Roast loading...";
}
