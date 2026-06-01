import * as z from "zod";

import { editorConfigSchema } from "../../editor/config";
import { footerConfigSchema } from "../../footer/config";
import { recapConfigSchema } from "../../recap/config";

export const userConfigSchema = z.object({
  editor: z.union([z.boolean(), editorConfigSchema]).optional(),
  footer: z.union([z.boolean(), footerConfigSchema]).optional(),
  recap: z.union([z.boolean(), recapConfigSchema]).optional(),
});

export type UserConfig = z.infer<typeof userConfigSchema>;
