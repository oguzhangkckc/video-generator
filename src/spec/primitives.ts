// Node scripts import the schema directly (type stripping), so schema files may only import zod and each
// other, always with explicit .ts extensions.
import { z } from "zod";

/** "@name", "@name.start", "@name.end", each with an optional "+0.35" / "-0.2" offset. */
export const MARK_REF = /^@([A-Za-z][A-Za-z0-9_]*)(?:\.(start|end))?([+-]\d+(?:\.\d+)?)?$/;

const MarkRef = z
  .string()
  .regex(MARK_REF, 'mark reference must look like "@name", "@name.start" or "@name+0.35"');
export const CueRef = z.object({ cue: z.string().min(1), offset: z.number().optional() }).strict();

export const TimeRaw = z.union([z.number(), MarkRef, CueRef]);
export const RangeRaw = z.union([z.tuple([TimeRaw, TimeRaw]), MarkRef]);

/**
 * Every schema is built twice from the same factory: with raw times (what spec.json is written in) and with
 * plain seconds (what components receive after src/spec/resolve.ts has replaced every reference).
 */
export type Kit<T extends z.ZodType = z.ZodType, R extends z.ZodType = z.ZodType> = { time: T; range: R };
export const RAW = { time: TimeRaw, range: RangeRaw };
export const RESOLVED = { time: z.number(), range: z.tuple([z.number(), z.number()]) };

export const EasingName = z.enum([
  "linear",
  "inQuad",
  "outQuad",
  "inOutQuad",
  "inCubic",
  "outCubic",
  "inOutCubic",
  "inOutSine",
]);

/** Semantic colours; hex values live only in src/kit/theme.ts. */
export const ColorToken = z.enum(["text", "you", "danger", "secondary", "marker", "muted"]);

export const SfxId = z.string().regex(/^[a-z][a-z0-9-]*$/);

/** Fade in over `in`, fade out over `out`; a missing side means "already visible" / "stays visible". */
export const windowSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.object({ in: k.range.optional(), out: k.range.optional() }).strict();

export const envelopeSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.object({ in: k.range, out: k.range }).strict();

/** Piecewise keyframes; between segments the previous end value holds. */
export const curveSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      unit: z.string().optional(),
      segments: z
        .array(
          z
            .object({
              from: k.time,
              to: k.time,
              values: z.tuple([z.number(), z.number()]),
              scale: z.enum(["linear", "log"]).default("linear"),
              /** Log scale interpolates log(value + logOffset), so a curve can start from 0. */
              logOffset: z.number().min(0).default(0),
              easing: EasingName.default("linear"),
            })
            .strict(),
        )
        .min(1),
    })
    .strict();
