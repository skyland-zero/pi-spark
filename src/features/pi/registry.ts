import { defineActionFor, registerComposedTool } from "../../utils/tool";

import type { Action } from "../../utils/tool";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface PiActionContext {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
}

export const defineAction = defineActionFor<PiActionContext>();

export function registerPiTool(pi: ExtensionAPI, actions: Action<PiActionContext, any, any>[]): void {
  registerComposedTool<PiActionContext>(pi, {
    name: "pi",
    label: "pi",
    descriptionIntro:
      "Inspect and adjust the current Pi session and model state. This tool groups " +
      "self-management actions over the running Pi instance:",
    descriptionOutro: "Use this tool to read or change Pi's own state instead of guessing.",
    promptSnippet: "Inspect and adjust the current Pi session and model state",
    generalGuidelines: [
      "The pi tool operates only on Pi's own session and model state; it does not read or modify the user's project, files, or task.",
    ],
    actions,
    createContext: (ctx) => ({ pi, ctx }),
  });
}
