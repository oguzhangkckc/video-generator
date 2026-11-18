import { z } from "zod";
import { ColorToken, SfxId, windowSchema, type Kit } from "../../../spec/primitives.ts";
import { driftSchema, shotSchema } from "../camera2d/schema.ts";

const msRange = z.tuple([z.number(), z.number()]);

/** One heartbeat in ms after the pacemaker fires, amplitudes in mV. Defaults: Klabunde, CV Physiology. */
const beatSchema = z
  .object({
    bpm: z.number().positive().default(72),
    p: z.object({ range: msRange.default([0, 90]), mv: z.number().default(0.15) }).strict().prefault({}),
    qrs: z
      .object({
        range: msRange.default([160, 230]),
        q: z.number().default(-0.1),
        r: z.number().default(1.2),
        s: z.number().default(-0.3),
      })
      .strict()
      .prefault({}),
    t: z.object({ range: msRange.default([330, 490]), mv: z.number().default(0.3) }).strict().prefault({}),
    /** Baseline wander so the line looks recorded, not drawn. */
    noiseMv: z.number().min(0).default(0.012),
  })
  .strict();

/** Monitor / paper ECG trace whose pen follows a clock curve, so one strip can run in real time or slow motion. */
export const ecgTraceSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      type: z.literal("ecgTrace"),
      id: z.string().optional(),
      visible: z.array(windowSchema(k)).min(1),
      /** Curve name, signal time in ms; 0 is the reference beat's pacemaker firing. */
      clock: z.string(),
      beat: beatSchema.prefault({}),
      paper: z
        .object({
          pxPerMm: z.number().positive().default(14),
          mmPerSec: z.number().positive().default(25),
          mmPerMv: z.number().positive().default(10),
          /** Shown under the strip at normal zoom, e.g. "25 mm/sn · 10 mm/mV". */
          legend: z.string().optional(),
        })
        .strict()
        .prefault({}),
      /** Pen position at zoom 1: fraction of the width, and the baseline in px. */
      penX: z.number().min(0).max(1).default(0.68),
      baselineY: z.number().default(1060),
      /** "frame" is the unzoomed screen, "pen" the pen tip on the baseline. */
      camera: z.array(shotSchema(k, z.union([z.enum(["frame", "pen"]), z.tuple([z.number(), z.number()])]))).min(1),
      drift: driftSchema.prefault({}),
      color: ColorToken.default("you"),
      /** Plays at every R peak the pen draws inside one of the ranges. */
      beep: z
        .object({ id: SfxId, gain: z.number().min(0).default(1), ranges: z.array(k.range).min(1) })
        .strict()
        .optional(),
    })
    .strict();
