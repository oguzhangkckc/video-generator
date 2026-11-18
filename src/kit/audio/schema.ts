import { z } from "zod";
import { SfxId, type Kit } from "../../spec/primitives.ts";

export const soundSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      /** Ambience that dips while the voice-over speaks. */
      beds: z
        .array(
          z
            .object({
              id: SfxId,
              at: k.time,
              fadeIn: k.range.optional(),
              fadeOut: k.range.optional(),
              /** Fraction removed while speaking (0.5 ≈ −6 dB). */
              duck: z.number().min(0).max(1).default(0.5),
            })
            .strict(),
        )
        .default([]),
      hits: z.array(z.object({ id: SfxId, at: k.time, gain: z.number().min(0).default(1) }).strict()).default([]),
      /** A licensed track from public/kit/music (see `npm run music -- list`). */
      music: z
        .object({
          file: z.string(),
          at: k.time.optional(),
          gain: z.number().min(0),
          duck: z.number().min(0).max(1).default(0.5),
          fadeIn: k.range.optional(),
          fadeOut: k.range.optional(),
          loop: z.boolean().default(false),
        })
        .strict()
        .optional(),
    })
    .strict();
