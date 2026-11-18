import { z } from "zod";
import { envelopeSchema, type Kit } from "../../spec/primitives.ts";

/** Atmosphere haze: the "fly through the air layer" pass when leaving or re-entering the planet. */
export const hazeSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.object({ type: z.literal("haze"), id: z.string().optional(), envelopes: z.array(envelopeSchema(k)).min(1) }).strict();

/** Radial light streaks for a "riding the signal at light speed" stretch. */
export const speedLinesSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.object({ type: z.literal("speedLines"), id: z.string().optional(), envelope: envelopeSchema(k) }).strict();

/** Rings leave a 3D point of a globe layer and rush past the camera. */
export const signalPassSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      type: z.literal("signalPass"),
      id: z.string().optional(),
      anchor: z.object({ layer: z.string(), point: z.enum(["emitter", "location", "hero"]) }).strict(),
      emits: z.array(k.time).min(1),
      duration: z.number().positive().default(1.3),
    })
    .strict();

/** A screen-filling ring shrinks onto the map marker's halo: the shape-matched hand-off back to 2D. */
export const ringShrinkSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      type: z.literal("ringShrink"),
      id: z.string().optional(),
      range: k.range,
      fromRadius: z.number().positive().default(1300),
      toRadius: z.number().positive().optional(),
    })
    .strict();

/** Closing dim; drawn above labels and titles, below the counter and captions. */
export const darkenSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.object({ range: k.range, alpha: z.number().min(0).max(1).default(0.92) }).strict();
