import { z } from "zod";
import { soundSchema } from "../kit/audio/schema.ts";
import {
  captionsSchema,
  conceptSchema,
  counterSchema,
  countdownSchema,
  labelSchema,
  layoutSchema,
  noteSchema,
  titleSchema,
} from "../kit/overlays/schema.ts";
import { cityMapSchema } from "../kit/scenes/city-map/schema.ts";
import { flowSchema } from "../kit/scenes/flow/schema.ts";
import { globeSchema } from "../kit/scenes/globe/schema.ts";
import { model3dSchema } from "../kit/scenes/model3d/schema.ts";
import { traceSchema } from "../kit/scenes/trace/schema.ts";
import {
  darkenSchema,
  hazeSchema,
  ringShrinkSchema,
  signalPassSchema,
  speedLinesSchema,
} from "../kit/transitions/schema.ts";
import { RAW, RESOLVED, curveSchema, type Kit } from "./primitives.ts";

/** Adding a scene type: write its schema next to its component, then list it here and in src/kit/registry.tsx. */
const layerSchema = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) =>
  z.discriminatedUnion("type", [
    globeSchema(k),
    cityMapSchema(k),
    model3dSchema(k),
    flowSchema(k),
    traceSchema(k),
    hazeSchema(k),
    speedLinesSchema(k),
    signalPassSchema(k),
    ringShrinkSchema(k),
  ]);

const voiceoverSchema = z
  .object({
    /** Path under public/, e.g. "videos/<slug>/vo.wav"; omit until a voice-over exists. */
    audio: z.string().optional(),
    /** Who or what speaks; also listed in credits. */
    voice: z.string().optional(),
    sections: z
      .array(
        z
          .object({
            id: z.string(),
            /** Seconds; drafts spread the phrases inside it, scripts/voiceover.mjs fits each section into it. */
            window: z.tuple([z.number().min(0), z.number().positive()]),
            /** One caption page each. */
            phrases: z.array(z.string().min(1)).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const markName = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, "mark names are letters, digits and _");

const buildSpec = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) =>
  z
    .object({
      $schema: z.string().optional(),
      /** Only videos/sablon: "[yer tutucu]" text is allowed there. `npm run new` drops the flag. */
      template: z.boolean().default(false),
      /** Sourced key values ("#name" elsewhere in the spec); every key names a `sources[].id`. */
      timeline: z
        .object({
          unit: z.string().optional(),
          keys: z.record(markName, z.object({ value: z.number(), source: z.string() }).strict()),
        })
        .strict()
        .optional(),
      title: z.string().min(1),
      lang: z.string().default("tr"),
      durationSec: z.number().positive().max(180),
      voiceover: voiceoverSchema,
      /** Named times and ranges, referenced elsewhere as "@name", "@name.start", "@name+0.3". "@end" is built in. */
      marks: z.record(markName, z.union([k.time, z.tuple([k.time, k.time])])).default({}),
      curves: z.record(z.string(), curveSchema(k)).default({}),
      /** Drawn in order, below every overlay. */
      layers: z.array(layerSchema(k)).default([]),
      labels: z.array(labelSchema(k)).default([]),
      notes: z.array(noteSchema(k)).default([]),
      titles: z.array(titleSchema(k)).default([]),
      darken: darkenSchema(k).optional(),
      countdown: countdownSchema(k).optional(),
      concept: conceptSchema(k).optional(),
      counter: counterSchema(k).optional(),
      captions: captionsSchema.prefault({}),
      layout: layoutSchema.prefault({}),
      sound: soundSchema(k).default({ beds: [], hits: [] }),
      sources: z
        .array(
          z
            .object({
              /** Referenced by timeline keys. */
              id: z.string().optional(),
              claim: z.string(),
              value: z.string().optional(),
              url: z.url(),
              accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              status: z.enum(["verified", "simplified", "disputed"]),
              note: z.string().optional(),
            })
            .strict(),
        )
        .default([]),
      credits: z
        .array(
          z
            .object({
              item: z.string(),
              kind: z.enum(["voice", "sfx", "music", "texture", "image", "font", "model", "code", "other"]),
              author: z.string(),
              license: z.string(),
              url: z.string().optional(),
              note: z.string().optional(),
            })
            .strict(),
        )
        .default([]),
      /** Where this video knowingly departs from STYLE.md, and why. */
      styleExceptions: z.array(z.string()).default([]),
    })
    .strict();

export const VideoSpec = buildSpec(RAW);
export const ResolvedSpec = buildSpec(RESOLVED);
export type VideoSpecInput = z.input<typeof VideoSpec>;
export type Spec = z.output<typeof ResolvedSpec>;
export type Layer = Spec["layers"][number];
export type LayerOf<K extends Layer["type"]> = Extract<Layer, { type: K }>;

export const Caption = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});
export type Caption = z.output<typeof Caption>;

/** Written by scripts/voiceover.mjs or scripts/align.mjs; never edited by hand. */
export const Timing = z
  .object({
    source: z.string(),
    audio: z.string().optional(),
    phrases: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() }).strict()),
    words: z.array(Caption),
  })
  .strict();
export type Timing = z.output<typeof Timing>;

export const VideoProps = z.object({ spec: VideoSpec, timing: Timing.nullable() });
