import { clampThinkingLevel, StringEnum } from "@earendil-works/pi-ai";
import Type from "typebox";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Static, TUnsafe } from "typebox";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const satisfies readonly ModelThinkingLevel[];
const DEFAULT_REASONING_LEVEL: ModelThinkingLevel = "off";

const ThinkingLevelSchema: TUnsafe<ModelThinkingLevel> = StringEnum(THINKING_LEVELS);

export const ModelSchema = Type.Object({
  provider: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinkingLevel: Type.Optional(ThinkingLevelSchema),
});

type ModelConfig = Static<typeof ModelSchema>;

export type RecapModel = {
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

  const fallback = clampThinkingLevel(model, DEFAULT_REASONING_LEVEL);
  return {
    thinkingLevel: fallback,
    warning: `Thinking level ${requested} is not supported by ${model.provider}/${model.id}; using ${fallback}.`,
  };
}
