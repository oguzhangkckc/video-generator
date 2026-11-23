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
      /** The curve's units per real second; when it runs slower or faster the counter says so ("×100 YAVAŞ"). */
      timeScale: z.object({ unitPerSec: z.number().positive() }).strict().optional(),
      /** Where the shown value may stand still for more than 3 s; anywhere else `npm run check` fails. */
      holds: z.array(k.range).default([]),
      /** Fades the counter out here (it also hides itself for the concept card). */
      until: k.time.optional(),
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
    /** Defaults to layout.contentWidth. */
    maxWidth: z.number().positive().optional(),
    /** Long enough to bridge a section pause, so the caption line never blinks empty mid-thought. */
    lingerMs: z.number().min(0).default(800),
  })
  .strict();

/** Safe-area layout (STYLE.md); the defaults keep text out of the right 120 px. */
export const layoutSchema = z
  .object({
    rightInset: z.number().min(0).default(132),
    contentWidth: z.number().positive().max(1080).default(840),
    /** Dark panel behind each column of data lines. */
    labelBackdrop: z.boolean().default(true),
    /** Move shots so the scene's important elements stay clear of panels, strips and captions (src/kit/framing.ts). */
    framing: z.boolean().default(false),
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
