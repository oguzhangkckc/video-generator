import { z } from "zod";
import { envelopeSchema, windowSchema, type Kit } from "../../../spec/primitives.ts";

const shotSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.discriminatedUnion("type", [
    /** From the surface out to a wide shot; distance follows a curve on a log scale. */
    z
      .object({
        type: z.literal("pullback"),
        from: k.time,
        progress: z.object({ curve: z.string(), logRange: z.tuple([z.number().positive(), z.number().positive()]) }),
        nearRadius: z.number().positive().default(0.1),
        wideRadius: z.number().gt(1).default(9),
        knee: z.number().gt(0).lt(1).default(0.85),
        overshoot: z.number().default(0.6),
        sweep: z.object({ range: k.range, angleRad: z.number(), lift: z.number().default(0.1) }).optional(),
      })
      .strict(),
    /** Behind the hero satellite, slowly circling it so the shot never freezes. */
    z
      .object({
        type: z.literal("follow"),
        from: k.time,
        blendIn: k.range.optional(),
        target: z.literal("hero"),
        circleSpeed: z.number().default(0.1),
        lift: z.number().default(0.45),
        back: z.number().default(1.3),
        aimBelow: z.number().default(0.45),
      })
      .strict(),
    /** From where the previous shot is at `from`, down onto the location, distance following a curve. */
    z
      .object({
        type: z.literal("descend"),
        from: k.time,
        alignUntil: k.time,
        aimUntil: k.time,
        curve: z.string(),
        curveTop: z.number().positive(),
      })
      .strict(),
  ]);

export const globeSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      type: z.literal("globe"),
      id: z.string(),
      /** Mounted only inside this range (WebGL is expensive). */
      window: k.range,
      texture: z.string().default("kit/earth/black-marble-8k.jpg"),
      location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
      orbits: z
        .object({
          count: z.number().int().min(1).default(6),
          satsPerOrbit: z.number().int().min(1).default(5),
          inclinationDeg: z.number().min(0).max(90).default(55),
          /** Earth radius = 1. */
          radius: z.number().gt(1).default(2.3),
          speedDegPerSec: z.number().default(2.5),
          /** Orbit 0's first satellite is directly above `location` at this time. */
          epoch: k.time,
          visible: windowSchema(k),
        })
        .strict()
        .optional(),
      /** Orbit 0's first satellite drawn as a model instead of a glow dot. */
      hero: z
        .object({
          visible: envelopeSchema(k),
          dim: z.object({ range: k.range, amount: z.number().min(0).max(1) }).optional(),
        })
        .strict()
        .optional(),
      /** Emission flash above the location at orbit height. */
      flash: z.object({ at: k.time }).strict().optional(),
      camera: z.array(shotSchema(k)).min(1),
    })
    .strict();
