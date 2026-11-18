import { z } from "zod";
import { ColorToken, SfxId, type Kit } from "../../spec/primitives.ts";

/** Two-line hook title; the opening one is already readable on frame 0. */
export const titleSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z.object({ top: z.string(), bottom: z.string(), from: k.time, to: k.time }).strict();

/** Monospace data line, optionally typed out, with an accent bar or a check mark. */
export const labelSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      text: z.string().min(1),
      at: k.time,
      until: k.time,
      top: z.number(),
      size: z.number().positive().default(48),
      color: ColorToken.default("text"),
      font: z.enum(["mono", "sans"]).default("mono"),
      align: z.enum(["left", "center", "right"]).default("left"),
      /** Characters per second. */
      typeSpeed: z.number().positive().optional(),
      bar: z.boolean().default(false),
      check: z.boolean().default(false),
      letterSpacing: z.string().default("0.02em"),
      /** Plays at `at`, so the sound moves with the line. */
      sound: SfxId.optional(),
    })
    .strict();

/** Small honesty note such as "ÖLÇEKLİ DEĞİL" or a simplification disclaimer. */
export const noteSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      text: z.string().min(1),
      at: k.time,
      until: k.time,
      top: z.number(),
      size: z.number().positive().default(22),
      align: z.enum(["left", "center", "right"]).default("right"),
    })
    .strict();

/** Fixed top-right meter driven by a curve. */
export const counterSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      label: z.string(),
      unit: z.string(),
      curve: z.string(),
      fadeIn: k.range,
      dim: z.object({ range: k.range, amount: z.number().min(0).max(1) }).strict().optional(),
      format: z
        .object({ zeroBelow: z.number().min(0).default(0.05), oneDecimalBelow: z.number().min(0).default(10) })
        .strict()
        .default({ zeroBelow: 0.05, oneDecimalBelow: 10 }),
    })
    .strict();

export const captionsSchema = z
  .object({
    /** Vertical centre as a fraction of the frame height. */
    y: z.number().min(0).max(1).default(0.77),
    maxFont: z.number().positive().default(60),
    maxWidth: z.number().positive().default(960),
    lingerMs: z.number().min(0).default(450),
  })
  .strict();

/** Climax countdown: the values share the range equally. */
export const countdownSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      from: k.time,
      to: k.time,
      values: z.array(z.string().min(1)).min(1),
      label: z.string().optional(),
      top: z.number().default(380),
      color: ColorToken.default("danger"),
      /** Plays at the start of every value. */
      sound: SfxId.optional(),
    })
    .strict();

/** The concept's name, revealed last. */
export const conceptSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      at: k.time,
      until: k.time.optional(),
      kicker: z.string().optional(),
      name: z.string().min(1),
      color: ColorToken.default("you"),
      top: z.number().default(560),
      sound: SfxId.optional(),
    })
    .strict();
