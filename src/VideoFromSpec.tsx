import { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { z } from "zod";
import { Soundtrack } from "./kit/audio/Soundtrack";
import { ConceptCard } from "./kit/overlays/ConceptCard";
import { Countdown } from "./kit/overlays/Countdown";
import { Counter } from "./kit/overlays/Counter";
import { DataLabel, NoteLabel } from "./kit/overlays/DataLabel";
import { HookTitle } from "./kit/overlays/HookTitle";
import { CX, CY } from "./kit/format";
import { FramingContext, adjustFor, logReport, type Framing } from "./kit/framing";
import { globeElements } from "./kit/scenes/globe/Globe";
import { layerName } from "./spec/scenes";
import { LayoutContext } from "./kit/layout";
import { reservedZones } from "./kit/overlays/boxes";
import { QaProbe } from "./kit/qa/QaProbe";
import { Karaoke } from "./kit/overlays/Karaoke";
import { LabelBackdrop } from "./kit/overlays/LabelBackdrop";
import { LayerView } from "./kit/registry";
import { createGlobeRig } from "./kit/scenes/globe/rig";
import { RigContext } from "./kit/scenes/globe/rig-context";
import { COLOR } from "./kit/theme";
import { Darken } from "./kit/transitions/Darken";
import { resolveVideo } from "./spec/resolve";
import type { Layer, VideoProps } from "./spec/schema";

/**
 * Scene layers in spec order, then data strips (traces with a panel), then the overlays in a fixed order: labels,
 * notes, titles, darken, finale, counter, captions.
 */
export const VideoFromSpec: React.FC<z.input<typeof VideoProps>> = ({ spec, timing, qa }) => {
  const video = useMemo(() => resolveVideo(spec, timing), [spec, timing]);
  const framing = useMemo((): Framing => {
    const cache = new Map<number, ReturnType<typeof reservedZones>>();
    const zonesAt = (t: number) => {
      const key = Math.round(t * 100);
      if (!cache.has(key)) cache.set(key, reservedZones(video, key / 100, video.spec.layout));
      return cache.get(key)!;
    };
    const spokenAt = (t: number) => video.phrases.find((p) => t >= p.start && t <= p.end)?.text ?? "";
    return { enabled: video.spec.layout.framing, zonesAt, spokenAt, report: qa?.probe ? logReport : null };
  }, [video, qa?.probe]);
  const strips = (layer: Layer) => layer.type === "trace" && Boolean(layer.panel);
  const rigs = useMemo(
    () =>
      Object.fromEntries(
        video.spec.layers.flatMap((l, i) => {
          if (l.type !== "globe") return [];
          const rig = createGlobeRig(l, video.curve);
          const name = layerName(l, i);
          // The planet moves aside (lens shift) for its satellite and location, like a 2D scene for its elements.
          rig.setFraming((t) =>
            adjustFor(framing, name, (u) => globeElements(l, rig, u, rig.rawProject).filter((e) => e.important), [CX, CY], t),
          );
          return [[l.id, rig]];
        }),
      ),
    [video, framing],
  );
  const s = video.spec;

  return (
    <RigContext.Provider value={rigs}>
      <LayoutContext.Provider value={s.layout}>
      <FramingContext.Provider value={framing}>
      <AbsoluteFill lang={s.lang} style={{ backgroundColor: COLOR.space }}>
        <Soundtrack sound={s.sound} voiceover={video.voiceoverAudio} phrases={video.phrases} />
        {s.layers.map((layer, i) => (strips(layer) ? null : <LayerView key={`layer-${i}`} layer={layer} video={video} index={i} />))}
        {s.layers.map((layer, i) => (strips(layer) ? <LayerView key={`strip-${i}`} layer={layer} video={video} index={i} /> : null))}
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
      </FramingContext.Provider>
      </LayoutContext.Provider>
    </RigContext.Provider>
  );
};
