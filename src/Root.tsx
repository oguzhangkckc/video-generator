import { Composition, Folder } from "remotion";
import { z } from "zod";
import { FPS, HEIGHT, WIDTH } from "./kit/format";
import { validateModels } from "./kit/scenes/model3d/validate";
import { captionFontReady, draftCaptionMisfits } from "./spec/caption-fit";
import { resolveVideo } from "./spec/resolve";
import { VideoProps } from "./spec/schema";
import { VideoFromSpec } from "./VideoFromSpec";

// Every videos/<slug>/spec.json becomes a composition with id <slug>. The timing is optional (estimated captions
// without it): the real voice-over's timing.json, else a placeholder voice's git-ignored timing.draft.json.
const specs = require.context("../videos", true, /^\.\/[a-z0-9-]+\/spec\.json$/);
const timings = require.context("../videos", true, /^\.\/[a-z0-9-]+\/timing(\.draft)?\.json$/);
const timingKeys = new Set(timings.keys());

const VIDEOS = specs.keys().map((key) => {
  const slug = key.split("/")[1];
  const timingKey = [`./${slug}/timing.json`, `./${slug}/timing.draft.json`].find((k) => timingKeys.has(k));
  return {
    slug,
    props: { spec: specs(key), timing: timingKey ? timings(timingKey) : null } as z.input<typeof VideoProps>,
  };
});

const Nothing: React.FC = () => null;
const DraftPhrases = z.object({ phrases: z.array(z.string()), misfits: z.array(z.string()) });

export const RemotionRoot: React.FC = () => (
  <>
  <Folder name="videolar">
    {VIDEOS.map(({ slug, props }) => (
        <Composition
          key={slug}
          id={slug}
          component={VideoFromSpec}
          schema={VideoProps}
          defaultProps={props}
          calculateMetadata={async ({ props: p }) => {
            await captionFontReady();
            const { spec } = resolveVideo(p.spec, p.timing);
            await validateModels(spec);
            return { durationInFrames: Math.round(spec.durationSec * FPS) };
          }}
          durationInFrames={1}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
    ))}
  </Folder>
  {/* npm run text measures a draft's phrases here (scripts/lib/caption-fit.mjs): same font, size and width as check. */}
  <Folder name="araclar">
    <Composition
      id="metin-olcu"
      component={Nothing}
      schema={DraftPhrases}
      defaultProps={{ phrases: [], misfits: [] }}
      calculateMetadata={async ({ props }) => ({ props: { ...props, misfits: await draftCaptionMisfits(props.phrases) } })}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </Folder>
  </>
);
