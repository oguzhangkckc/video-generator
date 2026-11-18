import { z } from "zod";
import { EasingName, type Kit } from "../../../spec/primitives.ts";

/** One keyframe of a flat (2D) camera; between shots the camera eases, after the last it holds and drifts. */
export const shotSchema = <T extends z.ZodType, R extends z.ZodType, F extends z.ZodType>(k: Kit<T, R>, focus: F) =>
  z
    .object({
      at: k.time,
      /** A named point of the scene or a world [x, y]; it lands on the layer's anchor. */
      focus,
      zoom: z.number().positive(),
      /** Degrees. */
      rotate: z.number().default(0),
      /** Easing of the move from the previous shot into this one. */
      easing: EasingName.default("inOutSine"),
    })
    .strict();

/** Keeps a held shot alive (STYLE: the camera never stops). */
export const driftSchema = z
  .object({
    degPerSec: z.number().default(0.3),
    /** Screen-pixel sway of the focus point. */
    px: z.number().min(0).default(10),
    periodSec: z.number().positive().default(7),
  })
  .strict();
