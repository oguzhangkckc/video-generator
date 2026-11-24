import { Audio } from "@remotion/media";
import { Sequence, staticFile, useVideoConfig } from "remotion";
import type { Spec } from "../../spec/schema";
import type { Phrase } from "../../spec/timing";
import { FPS } from "../format";
import { EASING, envelope, ramp, sec } from "../time";
import lengths from "./sfx-durations.json";
import { Sfx } from "./Sfx";

type Range = [number, number];

/** 0 in silence, 1 while the voice-over speaks, eased so beds dip and recover smoothly. */
const speakingFn = (phrases: Phrase[], bridge: number) => {
  const spans: { start: number; end: number }[] = [];
  for (const { start, end } of phrases) {
    const last = spans.at(-1);
    if (last && start - last.end < bridge) last.end = Math.max(last.end, end);
    else spans.push({ start, end });
  }
  return (t: number) => Math.max(0, ...spans.map(({ start, end }) => envelope(t, [start - 0.12, start], [end + 0.05, end + 0.4])));
};

const fades = (fadeIn?: Range, fadeOut?: Range) => (t: number) =>
  (fadeIn ? ramp(t, fadeIn) : 1) * (fadeOut ? 1 - ramp(t, fadeOut) : 1);

/** Real file lengths, written by `npm run sfx -- --index`. */
export const LENGTH: Record<string, number> = lengths;

/** Copies of a looping bed overlap by `xfade`, so there is always one fading in while the other fades out. */
export const loopStarts = (at: number, length: number, xfade: number, until: number) => {
  const starts: number[] = [];
  for (let s = at; s < until; s += length - xfade) starts.push(s);
  return starts;
};

/** Equal-power crossfade keeps the loudness steady through the overlap. */
const crossfade = (t: number, start: number, length: number, xfade: number, first: boolean, last: boolean) =>
  (first ? 1 : Math.sin((Math.PI / 2) * ramp(t, [start, start + xfade], [0, 1], EASING.linear))) *
  (last ? 1 : Math.cos((Math.PI / 2) * ramp(t, [start + length - xfade, start + length], [0, 1], EASING.linear)));

type Props = { sound: Spec["sound"]; voiceover?: string; phrases: Phrase[] };

/** Voice-over, ambience beds, music and scene-level hits; data-line sounds live on each label. */
export const Soundtrack: React.FC<Props> = ({ sound, voiceover, phrases }) => {
  const { durationInFrames, fps } = useVideoConfig();
  const end = durationInFrames / fps;
  const speaking = speakingFn(phrases, sound.duckBridge ?? 0.8);
  const { music } = sound;
  const musicFrom = sec(music?.at ?? 0);

  return (
    <>
      {voiceover ? <Audio src={staticFile(voiceover)} /> : null}

      {sound.beds.map((bed, i) => {
        const fade = fades(bed.fadeIn, bed.fadeOut);
        const gain = (t: number) => fade(t) * (1 - bed.duck * speaking(t));
        if (!bed.loop) return <Sfx key={`bed-${i}`} id={bed.id} at={bed.at} gain={gain} />;
        const starts = loopStarts(bed.at, LENGTH[bed.id], bed.crossfade, end);
        return starts.map((start, k) => (
          <Sfx
            key={`bed-${i}-${k}`}
            id={bed.id}
            at={start}
            gain={(t) => gain(t) * crossfade(t, start, LENGTH[bed.id], bed.crossfade, k === 0, k === starts.length - 1)}
          />
        ));
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
