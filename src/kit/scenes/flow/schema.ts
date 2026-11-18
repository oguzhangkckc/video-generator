import { z } from "zod";
import { ColorToken, windowSchema, type Kit } from "../../../spec/primitives.ts";
import { driftSchema, shotSchema } from "../camera2d/schema.ts";

const point = z.tuple([z.number(), z.number()]);
const id = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "ids are letters, digits, _ and -");
/** A node id or a world [x, y]. */
const place = z.union([id, point]);

/** How far along something is: a curve read between two values, or plain composition times. */
const progressSchema = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) =>
  z.union([
    z.object({ curve: z.string(), range: z.tuple([k.num, k.num]) }).strict(),
    z.object({ times: k.range }).strict(),
  ]);

/**
 * Flat diagram: shapes, nodes and paths, with signals travelling along the paths. The world is in px at zoom 1;
 * camera2d frames it. Colours are semantic tokens; fills and edges come from theme SURFACE / EDGE.
 */
export const flowSchema = <T extends z.ZodType, R extends z.ZodType, N extends z.ZodType>(k: Kit<T, R, N>) => {
  const progress = progressSchema(k);
  return z
    .object({
      type: z.literal("flow"),
      id: z.string().optional(),
      visible: z.array(windowSchema(k)).min(1),
      /** Filled shapes, drawn first (an organ, a building, a chip). */
      regions: z
        .array(
          z
            .object({
              id,
              points: z.array(point).min(3),
              smooth: z.boolean().default(true),
              fill: z.enum(["none", "surface", "faint"]).default("surface"),
              edge: z.enum(["none", "surface", "faint"]).default("surface"),
              /** Also clip the sweep and highlight to this region (e.g. a chamber inside an organ). */
              clipTo: id.optional(),
              /** A colour that floods the region from `origin` as `progress` goes 0 → 1. */
              sweep: z
                .object({ origin: place, reach: z.number().positive(), progress, color: ColorToken.default("you") })
                .strict()
                .optional(),
              /** Region visibility (e.g. a body outline that appears when the camera pulls out). */
              visible: windowSchema(k).optional(),
            })
            .strict(),
        )
        .default([]),
      paths: z
        .array(
          z
            .object({
              id,
              points: z.array(point).min(2),
              smooth: z.boolean().default(true),
              color: z.union([ColorToken, z.enum(["surface", "faint"])]).default("secondary"),
              opacity: z.number().min(0).max(1).default(0.4),
              width: z.number().positive().default(2.4),
            })
            .strict(),
        )
        .default([]),
      nodes: z
        .array(
          z
            .object({
              id,
              at: point,
              /** glow: hand-off dot (camera2d MATCH_DOT_R); pad: sensor/port that fades up close. */
              shape: z.enum(["glow", "dot", "ring", "pad"]).default("dot"),
              r: z.number().positive().default(9),
              color: ColorToken.default("secondary"),
              /** Glows in `you` over these ranges (a node the signal is passing through). */
              lit: z.array(k.range).default([]),
              /** An expanding ring at each time (a node firing). */
              flashes: z.array(k.time).default([]),
              /** Visibility (e.g. electrodes that come with the body outline). */
              visible: windowSchema(k).optional(),
            })
            .strict(),
        )
        .default([]),
      /** Something travelling along one path or a chain of paths; it leaves a lit trail. */
      signals: z
        .array(
          z
            .object({
              along: z.array(id).min(1),
              progress,
              color: ColorToken.default("you"),
              trail: z.boolean().default(true),
              head: z.boolean().default(true),
            })
            .strict(),
        )
        .default([]),
      /** Rings spreading from a place; each node in `lights` lights up when the first ring reaches it. */
      fields: z
        .array(
          z
            .object({
              origin: place,
              emits: z.array(k.time).min(1),
              duration: z.number().positive().default(1.6),
              maxRadius: z.number().positive().default(1000),
              color: ColorToken.default("secondary"),
              lights: z.array(id).default([]),
            })
            .strict(),
        )
        .default([]),
      /** Pulsing outline around a node, path or region while a label talks about it. */
      highlight: z.array(z.object({ target: id, range: k.range }).strict()).default([]),
      camera: z.array(shotSchema(k, place)).min(1),
      drift: driftSchema.prefault({}),
      /** Screen y where the camera's focus lands; match it with the layer this one hands off to. */
      anchorY: z.number().default(960),
    })
    .strict();
};
