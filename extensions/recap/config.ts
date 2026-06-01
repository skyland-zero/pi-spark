import * as z from "zod";

import { idleTimeoutSchema } from "./idle";
import { modelSchema } from "./model";

export const recapConfigSchema = modelSchema.extend({
  idle: idleTimeoutSchema.optional(),
});

export type RecapConfig = z.infer<typeof recapConfigSchema>;
