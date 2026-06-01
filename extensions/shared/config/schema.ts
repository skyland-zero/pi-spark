import Type from "typebox";
import Value from "typebox/value";

import { EditorConfigSchema } from "../../editor/config";
import { FooterConfigSchema } from "../../footer/config";
import { RecapConfigSchema } from "../../recap/config";

import type { Static } from "typebox";

const UserConfigSchema = Type.Object({
  editor: Type.Optional(Type.Union([Type.Boolean(), EditorConfigSchema])),
  footer: Type.Optional(Type.Union([Type.Boolean(), FooterConfigSchema])),
  recap: Type.Optional(Type.Union([Type.Boolean(), RecapConfigSchema])),
});

export type UserConfig = Static<typeof UserConfigSchema>;

export function resolveUserConfig(userConfig: unknown): UserConfig {
  return Value.Parse(UserConfigSchema, userConfig);
}
