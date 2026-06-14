import * as z from "zod";

export const webConfigSchema = z.object({});

export type WebConfig = z.infer<typeof webConfigSchema>;
