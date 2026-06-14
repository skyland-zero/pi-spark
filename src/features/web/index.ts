import { StringEnum } from "@earendil-works/pi-ai";
import { keyText } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { ExaClient } from "./client";
import { loadConfig } from "../../config";
import { joinTextContent } from "../../utils/format";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ACTIONS = {
  search: { tool: "web_search_exa", fields: ["query", "numResults"] as const },
  fetch: { tool: "web_fetch_exa", fields: ["urls", "maxCharacters"] as const },
} as const;

const COLLAPSED_MAX_LINES = 10;

export function registerWeb(pi: ExtensionAPI): void {
  const exa = new ExaClient();

  pi.on("session_start", (_event, ctx) => {
    const config = loadConfig(ctx).web;
    if (!config) return;

    pi.registerTool({
      name: "web",
      label: "web",
      description:
        "Access the live web via Exa: \"search\" finds current information across the web and " +
        "returns clean, ready-to-use content; \"fetch\" reads the full content of known URLs " +
        "as clean markdown.",
      promptSnippet: "Search the web and fetch page content via Exa",
      promptGuidelines: [
        "Use the web tool's \"search\" action for current information, news, facts, people, or companies; describe the ideal page rather than keywords (e.g., \"blog post comparing React and Vue performance\").",
        "Use the web tool's \"fetch\" action to read full content from known URLs, batching multiple URLs in one call, especially when search highlights are insufficient.",
      ],
      parameters: Type.Object({
        action: StringEnum(["search", "fetch"], {
          description: "The web action to run.",
        }),
        query: Type.Optional(Type.String({
          description:
            "For \"search\": the search query. Use a semantically rich description of the ideal " +
            "page, not just keywords. Optionally include category:<type> (company, people) to " +
            "focus results."
        })),
        numResults: Type.Optional(Type.Number({
          description: "For \"search\": number of search results (default 10).",
        })),
        urls: Type.Optional(Type.Array(Type.String(), {
          description: "For \"fetch\": URLs to read. Batch multiple URLs in one call.",
        })),
        maxCharacters: Type.Optional(Type.Number({
          description: "For \"fetch\": maximum characters to extract per page (default 3000).",
        })),
      }),
      renderCall(args, theme) {
        let text = `${theme.bold(theme.fg("toolTitle", "web"))} ${theme.fg("success", args.action)}`;

        if (args.action === "search") {
          const query = args.query?.trim();
          if (query) text += ` ${theme.fg("muted", query)}`;
          if (args.numResults !== undefined) text += ` ${theme.fg("warning", `${args.numResults} results`)}`;
        } else if (args.action === "fetch") {
          if (args.urls && args.urls.length > 0) text += ` ${theme.fg("muted", `${args.urls.join(", ")}`)}`;
          if (args.maxCharacters !== undefined) text += ` ${theme.fg("warning", `<= ${args.maxCharacters} chars`)}`;
        }

        return new Text(text, 0, 0);
      },
      renderResult(result, { expanded }, theme, context) {
        const container = new Container();
        container.addChild(new Spacer(1));

        const text = joinTextContent(result.content);

        if (context.isError) {
          container.addChild(new Text(theme.fg("error", text || "Web request failed."), 0, 0));
          return container;
        }

        const lines = text.length > 0 ? text.split("\n") : [];
        if (lines.length === 0) {
          container.addChild(new Text(theme.fg("muted", "(no content returned)"), 0, 0));
          return container;
        }

        const maxLines = expanded ? lines.length : Math.min(lines.length, COLLAPSED_MAX_LINES);
        container.addChild(new Text(theme.fg("muted", lines.slice(0, maxLines).join("\n")), 0, 0));

        const hidden = lines.length - maxLines;
        if (hidden > 0) {
          container.addChild(new Text(theme.fg("dim", `... (${hidden} more lines, ${keyText("app.tools.expand")} to expand)`), 0, 0));
        }

        return container;
      },
      async execute(_toolCallId, params, signal) {
        const action = ACTIONS[params.action as keyof typeof ACTIONS];
        if (!action) throw new Error(`Unknown web action "${params.action}".`);

        if (params.action === "search" && !params.query?.trim()) {
          throw new Error("The \"search\" action requires a non-empty \"query\".");
        }
        if (params.action === "fetch" && !(params.urls && params.urls.length > 0)) {
          throw new Error("The \"fetch\" action requires a non-empty \"urls\" array.");
        }

        const args: Record<string, unknown> = {};
        for (const field of action.fields) {
          const value = (params as Record<string, unknown>)[field];
          if (value !== undefined) args[field] = value;
        }

        const content = await exa.call(action.tool, args, signal);
        return { content, details: { action: params.action } };
      },
    });
  });

  pi.on("session_shutdown", () => {
    exa.close();
  });
}
