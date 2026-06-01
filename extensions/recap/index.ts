import { IdleDetector } from "./idle";
import { RecapManager } from "./manager";
import { loadConfig } from "../shared/config";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let idleDetector: IdleDetector | undefined = undefined;
  let recapManager: RecapManager | undefined = undefined;

  pi.on("session_start", (event, ctx) => {
    if (!ctx.hasUI) return;

    const config = loadConfig(ctx);
    if (config.recap === false) return;

    const recapConfig = typeof config.recap === "object" ? config.recap : {};
    recapManager = new RecapManager(pi, recapConfig);

    pi.registerCommand("recap", {
      description: "Generate a short recap of the current session",
      handler: async () => await recapManager?.run(ctx),
    });

    idleDetector = new IdleDetector(recapConfig.idle);
    idleDetector.addFactor(() => ctx.isIdle() && !ctx.hasPendingMessages());
    idleDetector.addFactor(() => ctx.ui.getEditorText());

    idleDetector.on("enter", () => recapManager?.run(ctx));
    idleDetector.on("activity", () => recapManager?.clear(ctx));

    if (event.reason === "resume" || event.reason === "fork") {
      idleDetector.watch();
    }
  });

  pi.on("input", () => {
    idleDetector?.emitActivity();
  });

  pi.on("user_bash", () => {
    idleDetector?.emitActivity();
  });

  pi.on("agent_start", () => {
    idleDetector?.emitActivity();
  });

  pi.on("session_before_compact", () => {
    idleDetector?.emitActivity();
  });

  pi.on("session_before_tree", () => {
    idleDetector?.emitActivity();
  });

  pi.on("agent_end", () => {
    idleDetector?.watch();
  });

  pi.on("session_compact", () => {
    idleDetector?.watch();
  });

  pi.on("session_tree", () => {
    idleDetector?.watch();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    recapManager?.clear(ctx);
    idleDetector?.dispose();
    idleDetector = undefined;
    recapManager = undefined;
  });
}
