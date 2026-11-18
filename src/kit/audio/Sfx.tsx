import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import { FPS } from "../format";
import { sec } from "../time";
import catalog from "./sfx-catalog.json";

// Every file is loudness-matched to -16 LUFS by scripts/sfx.mjs, so the catalog's levels are the whole mix.
const LEVEL: Record<string, number> = Object.fromEntries(Object.entries(catalog).map(([id, s]) => [id, s.level]));

type Props = {
  id: string;
  /** Composition time in seconds. */
  at: number;
  /** Multiplier on the catalog level; a function receives composition time in seconds. */
  gain?: number | ((t: number) => number);
};

export const Sfx: React.FC<Props> = ({ id, at, gain = 1 }) => {
  const from = sec(at);
  const level = LEVEL[id];
  return (
    <Sequence from={from} name={`sfx: ${id}`} layout="none">
      <Audio
        src={staticFile(`kit/sfx/${id}.wav`)}
        volume={typeof gain === "number" ? level * gain : (f) => level * gain((from + f) / FPS)}
      />
    </Sequence>
  );
};
