import { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { z } from "zod";
import { Soundtrack } from "./kit/audio/Soundtrack";
import { ConceptCard } from "./kit/overlays/ConceptCard";
import { Countdown } from "./kit/overlays/Countdown";
import { Counter } from "./kit/overlays/Counter";
import { DataLabel, NoteLabel } from "./kit/overlays/DataLabel";
import { HookTitle } from "./kit/overlays/HookTitle";
import { LayoutContext } from "./kit/layout";
import { QaProbe } from "./kit/qa/QaProbe";
import { Karaoke } from "./kit/overlays/Karaoke";
import { LabelBackdrop } from "./kit/overlays/LabelBackdrop";
import { LayerView } from "./kit/registry";
import { createGlobeRig } from "./kit/scenes/globe/rig";
import { RigContext } from "./kit/scenes/globe/rig-context";
import { COLOR } from "./kit/theme";
import { Darken } from "./kit/transitions/Darken";
import { resolveVideo } from "./spec/resolve";
import type { LayerOf, VideoProps } from "./spec/schema";

/** Layers in spec order, then the overlays in a fixed order: labels, notes, titles, darken, finale, counter, captions. */
export const VideoFromSpec: React.FC<z.input<typeof VideoProps>> = ({ spec, timing, qa }) => {
  const video = useMemo(() => resolveVideo(spec, timing), [spec, timing]);
  const rigs = useMemo(
    () =>
      Object.fromEntries(
        video.spec.layers
          .filter((l): l is LayerOf<"globe"> => l.type === "globe")
          .map((l) => [l.id, createGlobeRig(l, video.curve)]),
      ),
    [video],
  );
  const s = video.spec;

  return (
    <RigContext.Provider value={rigs}>
      <LayoutContext.Provider value={s.layout}>
      <AbsoluteFill lang={s.lang} style={{ backgroundColor: COLOR.space }}>
        <Soundtrack sound={s.sound} voiceover={video.voiceoverAudio} phrases={video.phrases} />
        {s.layers.map((layer, i) => (
          <LayerView key={`layer-${i}`} layer={layer} video={video} />
        ))}
        {qa?.overlays === false ? null : (
          <>
            {s.layout.labelBackdrop ? <LabelBackdrop labels={s.labels} /> : null}
            {s.labels.map((label, i) => (
              <DataLabel key={`label-${i}`} label={label} />
            ))}
            {s.notes.map((note, i) => (
              <NoteLabel key={`note-${i}`} note={note} />
            ))}
            {s.titles.map((title, i) => (
              <HookTitle key={`title-${i}`} {...title} />
            ))}
            {s.darken ? <Darken darken={s.darken} /> : null}
            {s.countdown ? <Countdown countdown={s.countdown} /> : null}
            {s.concept ? <ConceptCard concept={s.concept} /> : null}
            {s.counter ? (
              <Counter
                counter={s.counter}
                value={video.curve(s.counter.curve)}
                curve={s.curves[s.counter.curve]}
                locale={s.lang}
                conceptAt={s.concept?.at}
              />
            ) : null}
            <Karaoke pages={video.pages} captions={s.captions} />
          </>
        )}
        {qa?.probe ? <QaProbe video={video} /> : null}
      </AbsoluteFill>
      </LayoutContext.Provider>
    </RigContext.Provider>
  );
};
