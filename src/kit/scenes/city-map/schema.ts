import { z } from "zod";
import { curveSchema, windowSchema, type Kit } from "../../../spec/primitives.ts";

export const cityMapSchema = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) =>
  z
    .object({
      type: z.literal("cityMap"),
      id: z.string().optional(),
      /** Opacity is the strongest of these windows; outside them the map is not rendered. */
      visible: z.array(windowSchema(k)).min(1),
      layout: z.enum(["coastal-strait"]).default("coastal-strait"),
      /** Words the narration uses for the map itself ("harita"); while a phrase says one, qa checks the map is on screen. */
      say: z.array(z.string().min(1)).default([]),
      /** Changes the procedural districts and lights; omit for the reference city. */
      seed: z.string().optional(),
      zoom: z
        .object({
          /** Camera height above the street grid follows this curve (km). */
          curve: z.string(),
          eyeKm: z.number().positive(),
          pushIn: z.object({ range: k.range, amount: z.number() }).strict().optional(),
        })
        .strict(),
      /** Degrees. */
      rotation: curveSchema(k).optional(),
      marker: z
        .object({
          exit: z.object({ range: k.range, shrink: z.number().min(0).max(1).default(0.4) }).strict().optional(),
          /** Springs back in at `at`; its halo lights up around `haloAt`. */
          enter: z.object({ at: k.time, haloAt: k.time }).strict().optional(),
          /** Halo pulses while from <= t < to. */
          pulse: z.array(k.range).default([]),
        })
        .strict(),
      /** The marker slides off its true position (e.g. a positioning error), leaving a dashed ghost. */
      offset: z
        .object({
          range: k.range,
          px: z.number(),
          recenter: z.object({ range: k.range, amount: z.number().default(0.5) }).strict().optional(),
          ghost: z.boolean().default(true),
        })
        .strict()
        .optional(),
    })
    .strict();
