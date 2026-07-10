import * as z from "zod";

export const footerConfigSchema = z.object({
	hidden: z.boolean().optional().describe("Completely hide the footer bar"),
});
