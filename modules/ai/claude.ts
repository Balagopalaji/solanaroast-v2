import Anthropic from "@anthropic-ai/sdk";
import type { Model } from "@anthropic-ai/sdk/resources/messages";
import type {
  AIModule,
  MemeTemplateId,
  PromptInput,
  RoastOutput,
  TargetType,
} from "../types";

export const CLAUDE_MODEL: Model = "claude-haiku-4-5";

const MAX_OUTPUT_TOKENS = 512;

const SYSTEM_PROMPT = `You are the world's most savage but fair roast comedian, specialising in 
crypto culture. You know Solana inside out — the culture, the tokens, the 
degens, the drama. You roast based only on facts provided. You never invent 
data. You find the single most embarrassing intersection in the data and 
build the roast around it.

Rules:
- Max 3 sentences. Punchy. Every word earns its place.
- Roast the facts, not the person's character or appearance
- Find the contradiction or the irony — that's where the comedy lives
- Crypto-native voice: you know what BONK, WIF, Marginfi, Magic Eden are
- Never say "it looks like" or "it seems" — be declarative
- Output ONLY valid JSON, no prose outside the JSON

Output format:
{
  "roast": "...",
  "template": "<template_id>",
  "templateReason": "..."
}`;

const KNOWN_TEMPLATE_IDS = [
  "this-is-fine",
  "distracted-bf",
  "stonks",
  "not-stonks",
  "coffin-dance",
  "drake-no-yes",
  "galaxy-brain",
  "wojak-crying",
  "nft-guy",
  "wen-moon",
  "surprised-pikachu",
  "harold-pain",
  "two-buttons",
  "doge",
] as const satisfies readonly MemeTemplateId[];

const KNOWN_TEMPLATE_ID_SET: ReadonlySet<string> = new Set(KNOWN_TEMPLATE_IDS);

const TARGET_LABELS: Record<TargetType, string> = {
  wallet: "Solana Wallet",
  token: "Crypto Token",
  twitter: "Twitter Profile",
};

export class ClaudeModule implements AIModule {
  private client: Anthropic | null = null;

  async generateRoast(prompt: PromptInput): Promise<RoastOutput> {
    validatePromptInput(prompt);

    const message = await this.getClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(prompt),
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["roast", "template", "templateReason"],
            properties: {
              roast: {
                type: "string",
                minLength: 1,
              },
              template: {
                type: "string",
                enum: prompt.templates.map((template) => template.id),
              },
              templateReason: {
                type: "string",
                minLength: 1,
              },
            },
          },
        },
      },
    });

    return validateRoastPayload(extractText(message.content), prompt);
  }

  private getClient(): Anthropic {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Claude roast generation requires ANTHROPIC_API_KEY to be set.",
      );
    }

    this.client = new Anthropic({ apiKey });
    return this.client;
  }
}

function buildUserPrompt(prompt: PromptInput): string {
  const facts = prompt.facts
    .map((fact) => {
      const roastable = fact.roastable ? " ⚠️ ROASTABLE" : "";
      const roastHint = fact.roastHint ? ` — ${fact.roastHint}` : "";

      return `- ${fact.label}: ${fact.value}${roastable}${roastHint}`;
    })
    .join("\n");

  const templates = prompt.templates
    .map(
      (template, index) =>
        `${index + 1}. ${template.id} — ${template.description}`,
    )
    .join("\n");

  return `Target: ${TARGET_LABELS[prompt.targetType]}
Display: ${prompt.displayName}

Facts:
${facts}

Available meme templates:
${templates}

Pick the template that fits best. Return only JSON.`;
}

function validatePromptInput(prompt: PromptInput): void {
  if (!prompt.displayName.trim()) {
    throw new Error("Claude roast generation requires a displayName.");
  }

  if (prompt.facts.length === 0) {
    throw new Error("Claude roast generation requires at least one fact.");
  }

  if (prompt.templates.length === 0) {
    throw new Error("Claude roast generation requires at least one template.");
  }

  const invalidTemplate = prompt.templates.find(
    (template) => !isKnownTemplateId(template.id),
  );
  if (invalidTemplate) {
    throw new Error(`Unknown meme template id: ${invalidTemplate.id}`);
  }
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const text = content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Claude returned no text content for roast generation.");
  }

  return text;
}

function validateRoastPayload(text: string, prompt: PromptInput): RoastOutput {
  const parsed = parseClaudeJson(text);

  if (!isRecord(parsed)) {
    throw new Error("Claude roast response must be a JSON object.");
  }

  const roast = validateNonEmptyString(parsed.roast, "roast");
  const template = validateTemplateId(parsed.template, prompt);
  const templateReason = validateNonEmptyString(
    parsed.templateReason,
    "templateReason",
  );

  return {
    roast,
    template,
    templateReason,
  };
}

function parseClaudeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const extracted = extractJsonObject(text);
    if (!extracted) {
      throw new Error(
        `Claude returned invalid JSON for roast generation: ${describeError(error)}`,
      );
    }

    try {
      return JSON.parse(extracted);
    } catch (extractedError) {
      throw new Error(
        `Claude returned invalid JSON for roast generation: ${describeError(extractedError)}`,
      );
    }
  }
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function validateTemplateId(value: unknown, prompt: PromptInput): MemeTemplateId {
  const template = validateNonEmptyString(value, "template");
  if (!isKnownTemplateId(template)) {
    throw new Error(`Claude returned unknown meme template id: ${template}`);
  }

  const availableTemplateIds = new Set(
    prompt.templates.map((availableTemplate) => availableTemplate.id),
  );
  if (!availableTemplateIds.has(template)) {
    throw new Error(
      `Claude returned unavailable meme template id: ${template}`,
    );
  }

  return template;
}

function validateNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Claude roast response field "${field}" must be a string.`);
  }

  return value.trim();
}

function isKnownTemplateId(value: string): value is MemeTemplateId {
  return KNOWN_TEMPLATE_ID_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
