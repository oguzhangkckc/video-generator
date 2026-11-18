import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";
import type { Spec } from "../../spec/schema";
import type { Phrase } from "../../spec/timing";
import { FPS } from "../format";
import { envelope, ramp, sec } from "../time";
import { Sfx } from "./Sfx";

type Range = [number, number];

/** 0 in silence, 1 while the voice-over speaks, eased so beds dip and recover smoothly. */
const speakingFn = (phrases: Phrase[]) => (t: number) =>
  Math.max(0, ...phrases.map(({ start, end }) => envelope(t, [start - 0.12, start], [end + 0.05, end + 0.4])));

const fades = (fadeIn?: Range, fadeOut?: Range) => (t: number) =>
  (fadeIn ? ramp(t, fadeIn) : 1) * (fadeOut ? 1 - ramp(t, fadeOut) : 1);

type Props = { sound: Spec["sound"]; voiceover?: string; phrases: Phrase[] };

/** Voice-over, ambience beds, music and scene-level hits; data-line sounds live on each label. */
export const Soundtrack: React.FC<Props> = ({ sound, voiceover, phrases }) => {
  const speaking = speakingFn(phrases);
  const { music } = sound;
  const musicFrom = sec(music?.at ?? 0);

  return (
    <>
      {voiceover ? <Audio src={staticFile(voiceover)} /> : null}

      {sound.beds.map((bed, i) => {
        const fade = fades(bed.fadeIn, bed.fadeOut);
        return <Sfx key={`bed-${i}`} id={bed.id} at={bed.at} gain={(t) => fade(t) * (1 - bed.duck * speaking(t))} />;
      })}
      {sound.hits.map((hit, i) => (
        <Sfx key={`hit-${i}`} id={hit.id} at={hit.at} gain={hit.gain} />
      ))}

      {music ? (
        <Sequence from={musicFrom} name="music" layout="none">
          <Audio
            src={staticFile(music.file)}
            loop={music.loop}
            volume={(f) => {
              const t = (musicFrom + f) / FPS;
              return music.gain * fades(music.fadeIn, music.fadeOut)(t) * (1 - music.duck * speaking(t));
            }}
          />
        </Sequence>
      ) : null}
    </>
  );
};
