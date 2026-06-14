import { nameAction } from "./actions/name";
import { modelsAction } from "./actions/models";
import { whoamiAction } from "./actions/whoami";
import { registerPiTool } from "./registry";
import { loadConfig } from "../../config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Self-management actions exposed by the pi tool, ordered alphabetically by action name. */
const ACTIONS = [
  modelsAction,
  nameAction,
  whoamiAction,
];

export function registerPi(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).pi;
    if (!config) return;

    registerPiTool(pi, ACTIONS);
  });
}
