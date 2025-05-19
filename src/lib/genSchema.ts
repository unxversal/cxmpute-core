import { z } from "zod";

export const GenResult = z.object({
  code: z.string(),
  commentary: z.string().optional(),
  finished: z.boolean().default(false)
});

// Handy TypeScript alias
export type GenResultType = z.infer<typeof GenResult>;
