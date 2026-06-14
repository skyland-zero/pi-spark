import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { joinTextContent } from "../../utils/format";

import type { AgentToolResult, ExtensionAPI, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { Static, TObject, TProperties, TSchema } from "typebox";

const DESCRIPTION_INTRO =
  "Inspect and adjust the current pi session and model state. This tool groups self-management " +
  "actions over the running pi instance:";

const DESCRIPTION_OUTRO = "Use this tool to read or change pi's own state instead of guessing.";

const GENERAL_GUIDELINE =
  "The pi tool operates only on pi's own session and model state; it does not read or modify the " +
  "user's project, files, or task.";

interface ActionDetails {
  action: string;
}

interface ActionContext {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
}

/**
 * One self-management action of the pi tool, owning its fields, execution, and rendering. The
 * registry merges every action's `fields` into one flat object schema (provider-safe, unlike a
 * discriminated union; see the StringEnum note in pi's extension docs) and dispatches by `action`.
 */
interface Action<F extends TProperties = TProperties, D extends ActionDetails = ActionDetails> {
  name: D["action"];
  summary: string;
  fields: F;
  /** Fields required at runtime, since the flat schema makes every action's fields optional. */
  required?: (keyof F & string)[];
  /** Guideline bullets contributed to the tool's system-prompt guidelines. */
  promptGuidelines?: string[];
  renderCall?: NonNullable<ToolDefinition<TObject<F>, D>["renderCall"]>;
  renderResult?: NonNullable<ToolDefinition<TObject<F>, D>["renderResult"]>;
  execute(args: Static<TObject<F>>, context: ActionContext, signal: AbortSignal | undefined): Promise<AgentToolResult<D>>;
}

/** Identity helper that preserves per-action field and details inference at the definition site. */
export function defineAction<F extends TProperties, D extends ActionDetails>(action: Action<F, D>): Action<F, D> {
  return action;
}

/**
 * Compose the actions into a single flat-schema tool and register it as `pi`. Actions are
 * heterogeneous, so the collection is typed loosely here; type safety lives at each `defineAction`.
 */
export function registerPiTool(pi: ExtensionAPI, actions: Action<any, any>[]): void {
  const byName = new Map<string, Action<any, any>>();
  const mergedFields: TProperties = {};

  for (const action of actions) {
    if (byName.has(action.name)) throw new Error(`Duplicate pi action "${action.name}".`);
    byName.set(action.name, action);

    for (const [key, schema] of Object.entries(action.fields)) {
      if (key === "action") throw new Error(`pi action "${action.name}" must not define a field named "action".`);
      if (key in mergedFields) throw new Error(`pi action "${action.name}" redefines field "${key}"; field names must be unique across actions.`);
      mergedFields[key] = Type.Optional(schema as TSchema);
    }
  }

  const summaries = actions.map((action) => `"${action.name}" ${action.summary}`).join("; ");

  const parameters = Type.Object({
    action: StringEnum(actions.map((action) => action.name), { description: "The pi action to run." }),
    ...mergedFields,
  });

  pi.registerTool({
    name: "pi",
    label: "pi",
    description: `${DESCRIPTION_INTRO} ${summaries}. ${DESCRIPTION_OUTRO}`,
    promptSnippet: "Inspect and adjust the current pi session and model state",
    promptGuidelines: [GENERAL_GUIDELINE, ...actions.flatMap((action) => action.promptGuidelines ?? [])],
    parameters,
    renderCall(args, theme, context) {
      const action = byName.get(args.action);
      if (action?.renderCall) return action.renderCall(args, theme, context);

      return new Text(`${theme.bold(theme.fg("toolTitle", "pi"))} ${theme.fg("accent", args.action)}`, 0, 0);
    },
    renderResult(result, options, theme, context) {
      const details = result.details as ActionDetails | undefined;

      if (context.isError || !details) {
        const output = joinTextContent(result.content);
        return new Text(context.isError && output ? theme.fg("error", "\n" + output) : "", 0, 0);
      }

      const action = byName.get(details.action);
      if (action?.renderResult) return action.renderResult(result as AgentToolResult<ActionDetails>, options, theme, context);

      return new Text(joinTextContent(result.content), 0, 0);
    },
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const action = byName.get(params.action);
      if (!action) throw new Error(`Unknown pi action "${params.action}".`);

      for (const field of action.required ?? []) {
        if ((params as Record<string, unknown>)[field] === undefined) {
          throw new Error(`The "${params.action}" action requires "${field}".`);
        }
      }

      return action.execute(params as never, { pi, ctx }, signal);
    },
  });
}
