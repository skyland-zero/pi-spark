import { clampThinkingLevel } from "@earendil-works/pi-ai";
import * as z from "zod";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const satisfies readonly ModelThinkingLevel[];
const DEFAULT_THINKING_LEVEL: ModelThinkingLevel = "off";

export const modelSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  thinkingLevel: z.enum(THINKING_LEVELS).optional(),
});

type ModelConfig = z.infer<typeof modelSchema>;

type RecapModel = {
  model: Model<Api>;
  thinkingLevel: ModelThinkingLevel;
  warning: string | undefined;
};

export async function resolveRecapModel(pi: ExtensionAPI, ctx: ExtensionContext, config: ModelConfig): Promise<RecapModel | undefined> {
  const fallbackModel = ctx.model;
  if (!fallbackModel) {
    ctx.ui.notify("No model selected for recap", "warning");
    return;
  }

  let model = fallbackModel;
  let warning: string | undefined;

  if (config.provider || config.model) {
    if (!config.provider || !config.model) {
      warning = "Both recap.provider and recap.model are required; using the current model.";
    } else {
      const configuredModel = ctx.modelRegistry.find(config.provider, config.model);
      if (configuredModel) {
        const auth = await ctx.modelRegistry.getApiKeyAndHeaders(configuredModel);
        if (auth.ok) {
          model = configuredModel;
        } else {
          warning = `Model ${config.provider}/${config.model} unavailable: ${auth.error}; using the current model.`;
        }
      } else {
        warning = `Model ${config.provider}/${config.model} not found; using the current model.`;
      }
    }
  }

  const { thinkingLevel, warning: thinkingLevelWarning } = resolveThinkingLevel(model, config.thinkingLevel ?? pi.getThinkingLevel());

  return {
    model,
    thinkingLevel,
    warning: [warning, thinkingLevelWarning].filter(Boolean).join(" ") || undefined,
  };
}

function resolveThinkingLevel(model: Model<Api>, requested: ModelThinkingLevel): { thinkingLevel: ModelThinkingLevel; warning?: string } {
  const thinkingLevel = clampThinkingLevel(model, requested);
  if (thinkingLevel === requested) return { thinkingLevel };

  const fallback = clampThinkingLevel(model, DEFAULT_THINKING_LEVEL);
  return {
    thinkingLevel: fallback,
    warning: `Thinking level ${requested} is not supported by ${model.provider}/${model.id}; using ${fallback}.`,
  };
}
