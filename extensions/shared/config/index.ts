import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

import { resolveUserConfig } from "./schema";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TLocalizedValidationError } from "typebox/error";
import type { UserConfig } from "./schema";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type ConfigValue = { [key: string]: JsonValue };

export function loadConfig(ctx: ExtensionContext, fileName: string = "spark.json"): UserConfig {
  const userConfig = loadMergedJson(getConfigPaths(ctx.cwd, fileName));

  try {
    return resolveUserConfig(userConfig ?? {});
  } catch (error) {
    const errors = (error as any).cause?.errors as TLocalizedValidationError[];

    const message = errors.map((error) => {
      const allowedValues = (error.params as any)?.allowedValues;
      return `${error.instancePath} ${error.message}${allowedValues ? ` (${allowedValues.join(", ")})` : ""}`
    }).join("; ");

    ctx.ui.notify(`Invalid spark config: ${message}`, "error");

    return {};
  }
}

function getConfigPaths(cwd: string, fileName: string): [globalPath: string, projectPath: string] {
  return [join(getAgentDir(), fileName), join(cwd, ".pi", fileName)];
}

function loadMergedJson(paths: string[]): ConfigValue | undefined {
  let merged: ConfigValue | undefined;
  paths.forEach((path) => {
    const value = readJsonFile(path);
    if (value === undefined) return;

    merged = mergeConfig(merged, value);
  })

  return merged;
}

function readJsonFile(path: string): ConfigValue | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ConfigValue;
  } catch {
    return undefined;
  }
}

function mergeConfig(base: ConfigValue | undefined, override: ConfigValue): ConfigValue {
  if (base === undefined) return override;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const result: Record<string, JsonValue> = { ...base };
  Object.entries(override).forEach(([key, overrideValue]) => {
    const baseValue = base[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = { ...baseValue, ...overrideValue };
    } else {
      result[key] = overrideValue;
    }
  })

  return result;
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
