import { z } from "zod";

export const GenResultCad = z.object({
  code: z.string(),
  commentary: z.string().optional(),
  finished: z.boolean().default(false),
});

export type GenResultCadType = z.infer<typeof GenResultCad>;
