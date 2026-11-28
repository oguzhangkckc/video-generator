import { z } from "zod";
import { ColorToken, SfxId, windowSchema, type Kit } from "../../../spec/primitives.ts";
import { driftSchema, shotSchema } from "../camera2d/schema.ts";

const noise = z.number().min(0).default(0);

/**
 * The repeating signal, in clock units (x) and value units (y). "ecg" is one heartbeat in ms after the pacemaker
 * fires, in mV; ranges default to ECG_DEFAULTS in waveform.ts, and every time may be a sourced "#key".
 */
const waveformSchema = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) => {
  const span = z.tuple([k.num, k.num]);
  return z.discriminatedUnion("preset", [
    z
      .object({
        preset: z.literal("ecg"),
        bpm: z.number().positive().default(72),
        p: z.object({ range: span.optional(), mv: z.number().default(0.15) }).strict().prefault({}),
        qrs: z
          .object({
            range: span.optional(),
            q: z.number().default(-0.1),
            r: z.number().default(1.2),
            s: z.number().default(-0.3),
          })
          .strict()
          .prefault({}),
        t: z.object({ range: span.optional(), mv: z.number().default(0.3) }).strict().prefault({}),
        noise: z.number().min(0).default(0.012),
      })
      .strict(),
    z
      .object({
        preset: z.enum(["sine", "square", "saw"]),
        period: z.number().positive(),
        amplitude: z.number().default(1),
        noise,
      })
      .strict(),
    z
      .object({
        preset: z.literal("samples"),
        period: z.number().positive(),
        /** [x within the period, value], linear in between. */
        points: z.array(z.tuple([z.number(), z.number()])).min(2),
        noise,
      })
      .strict(),
  ]);
};

/** Monitor or chart line whose pen follows a clock curve, so one strip can run in real time or slow motion. */
export const traceSchema = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) =>
  z
    .object({
      type: z.literal("trace"),
      id: z.string().optional(),
      visible: z.array(windowSchema(k)).min(1),
      /** Curve name: where the pen is, in waveform x units. */
      clock: z.string(),
      waveform: waveformSchema(k),
      /** Defaults: ECG paper at 16 px/mm (25 mm/s → 0.4 px/ms, 10 mm/mV → 160 px/mV, 1 mm squares). */
      grid: z
        .object({
          pxPerX: z.number().positive().default(0.4),
          pxPerY: z.number().positive().default(160),
          minorX: z.number().positive().default(40),
          minorY: z.number().positive().default(0.1),
          majorEvery: z.number().int().positive().default(5),
          legend: z.string().optional(),
        })
        .strict()
        .prefault({}),
      /** Pen position at zoom 1: fraction of the width, and the baseline in px. */
      penX: z.number().min(0).max(1).default(0.68),
      baselineY: z.number().default(1060),
      /** Screen y where the camera's focus lands; match it with the layer this one hands off to. */
      anchorY: z.number().default(960),
      /**
       * A data strip on top of the scenes: drawn in a dark panel across the frame at `top` (an overlay, like the
       * label panels; the camera keeps other scenes' important elements clear of it). Without it the trace is a scene.
       */
      panel: z.object({ top: z.number().min(0), height: z.number().positive() }).strict().optional(),
      /** "frame" is the unzoomed screen, "pen" the pen tip on the baseline. */
      camera: z.array(shotSchema(k, z.union([z.enum(["frame", "pen"]), z.tuple([z.number(), z.number()])]))).min(1),
      drift: driftSchema.prefault({}),
      color: ColorToken.default("you"),
      /**
       * Words the narration uses for the line as a whole ("çizgi", "yazı"); while a phrase says one, the drawn line is
       * important and qa checks it is on screen. Parts have their own `say`.
       */
      say: z.array(z.string().min(1)).default([]),
      /** Named stretches of the waveform, lit and labelled while the pen draws them (P, QRS, T…). */
      parts: z
        .array(
          z
            .object({
              text: z.string().min(1),
              range: z.tuple([k.num, k.num]),
              color: ColorToken.default("secondary"),
              /** Only the period that contains clock 0 (the reference beat); otherwise every period. */
              once: z.boolean().default(true),
              /**
               * bracket: a stretch (a duration, a segment such as PR), labelled under the baseline with a bracket;
               * leader: a point or a wave (P, QRS, T), labelled above the line, tied to its peak by a short line.
               */
              marker: z.enum(["bracket", "leader"]).default("leader"),
              /** Words the narration uses for this part (see flow `say`). */
              say: z.array(z.string().min(1)).default([]),
              /** Lit up (brighter, larger label) over these ranges, e.g. while the narration names the part. */
              lit: z.array(k.range).default([]),
            })
            .strict(),
        )
        .default([]),
      /** Plays at every peak the pen draws inside one of the ranges. */
      beep: z
        .object({ id: SfxId, gain: z.number().min(0).default(1), ranges: z.array(k.range).min(1) })
        .strict()
        .optional(),
    })
    .strict();
