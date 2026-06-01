import Type from "typebox";

import { IdleTimeoutSchema } from "./idle";
import { ModelSchema } from "./model";

import type { Static } from "typebox";

export const RecapConfigSchema = Type.Object({
  idle: Type.Optional(IdleTimeoutSchema),
  ...ModelSchema.properties,
});

export type RecapConfig = Static<typeof RecapConfigSchema>;
