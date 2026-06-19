import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { formatModel, formatTokens } from "../../utils/format";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";

/** Pi's built-in default thinking level, clamped per model. Not exported by Pi's public API. */
const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "medium";

export type ModelMetadata = Omit<Model<Api>, "headers" | "compat"> & {
  thinkingLevels: ModelThinkingLevel[];
  defaultThinkingLevel: ModelThinkingLevel;
  available: boolean;
};

export type ModelRow = {
  label: string;
  cost: string;
  context: string;
  available: boolean;
};

export function toMetadata(model: Model<Api>, available: boolean): ModelMetadata {
  const { headers: _headers, compat: _compat, ...metadata } = model;

  return {
    ...metadata,
    thinkingLevels: getSupportedThinkingLevels(model),
    defaultThinkingLevel: clampThinkingLevel(model, DEFAULT_THINKING_LEVEL),
    available,
  };
}

export function toModelRow(model: ModelMetadata, thinkingLevel?: ModelThinkingLevel): ModelRow {
  return {
    label: formatModel(model.provider, model.id, thinkingLevel),
    cost: `$${formatPrice(model.cost.input)}/$${formatPrice(model.cost.output)}`,
    context: formatTokens(model.contextWindow),
    available: model.available,
  };
}

/** Round to at most 2 decimals and trim float noise: 0.7999... -> 0.8, 0.0983 -> 0.1, 15 -> 15. */
function formatPrice(value: number): string {
  return String(parseFloat(value.toFixed(2)));
}

/** Notice line describing truncation or remaining pages, shared by the text result and the TUI. */
export function formatListNotice(truncated: boolean, startIndex: number, endDisplay: number, total: number): string | undefined {
  const nextOffset = endDisplay + 1;

  if (truncated) return `[Truncated: showing models ${startIndex + 1}-${endDisplay} of ${total}. Use offset=${nextOffset} to continue.]`;
  if (endDisplay < total) return `[${total - endDisplay} more models in list. Use offset=${nextOffset} to continue.]`;

  return undefined;
}
