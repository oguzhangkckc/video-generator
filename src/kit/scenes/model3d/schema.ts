import { z } from "zod";
import { ColorToken, EasingName, windowSchema, type Kit } from "../../../spec/primitives.ts";

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

/**
 * A GLB/glTF model from public/kit/models (licence in <id>.json, `npm run models -- list`). The model is centred and
 * scaled to radius 1, so camera distances and points are in model radii whatever the file's units.
 */
export const model3dSchema = <T extends z.ZodType, R extends z.ZodType>(k: Kit<T, R>) =>
  z
    .object({
      type: z.literal("model3d"),
      id: z.string().optional(),
      /** Mounted only inside this range: WebGL is expensive. */
      window: k.range,
      fade: windowSchema(k).default({}),
      /** Under public/, e.g. "kit/models/flight-helmet.glb". */
      file: z.string().regex(/\.(glb|gltf)$/, "a .glb or .gltf file under public/"),
      camera: z
        .array(
          z
            .object({
              at: k.time,
              /** Degrees around the vertical axis, 0 = in front. */
              azimuth: z.number().default(30),
              /** Degrees above the horizon. */
              elevation: z.number().default(15),
              distance: z.number().positive().default(3),
              /** A part name, or a point in model space. */
              target: z.union([z.string(), vec3]).optional(),
              fov: z.number().positive().default(35),
              easing: EasingName.default("inOutSine"),
            })
            .strict(),
        )
        .min(1),
      /** Slow orbit on top of the shots, so a held shot never freezes. */
      orbitDegPerSec: z.number().default(3),
      highlight: z
        .array(z.object({ part: z.string(), color: ColorToken.default("you"), range: k.range }).strict())
        .default([]),
      /** How much the other parts darken while something is highlighted. */
      dimOthers: z.number().min(0).max(1).default(0.6),
      /** Cut-away: a plane sweeps along `axis` from `from` to `to` (fractions of the model, 1 = nothing cut). */
      section: z
        .object({
          axis: z.enum(["x", "y", "z"]).default("x"),
          range: k.range,
          from: z.number().min(0).max(1).default(1),
          to: z.number().min(0).max(1).default(0.5),
        })
        .strict()
        .optional(),
      /** Exploded view: parts move out from the centre by `distance` model radii. */
      explode: z
        .object({ range: k.range, distance: z.number().default(0.6), parts: z.array(z.string()).optional() })
        .strict()
        .optional(),
    })
    .strict();
