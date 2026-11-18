import { Composition, Folder } from "remotion";
import type { z } from "zod";
import { FPS, HEIGHT, WIDTH } from "./kit/format";
import { validateModels } from "./kit/scenes/model3d/validate";
import { resolveVideo } from "./spec/resolve";
import { VideoProps } from "./spec/schema";
import { VideoFromSpec } from "./VideoFromSpec";

// Every videos/<slug>/spec.json becomes a composition with id <slug>; timing.json is optional (draft captions).
const specs = require.context("../videos", true, /^\.\/[a-z0-9-]+\/spec\.json$/);
const timings = require.context("../videos", true, /^\.\/[a-z0-9-]+\/timing\.json$/);
const timingKeys = new Set(timings.keys());

const VIDEOS = specs.keys().map((key) => {
  const slug = key.split("/")[1];
  const timingKey = `./${slug}/timing.json`;
  return {
    slug,
    props: { spec: specs(key), timing: timingKeys.has(timingKey) ? timings(timingKey) : null } as z.input<typeof VideoProps>,
  };
});

export const RemotionRoot: React.FC = () => (
  <Folder name="videolar">
    {VIDEOS.map(({ slug, props }) => (
        <Composition
          key={slug}
          id={slug}
          component={VideoFromSpec}
          schema={VideoProps}
          defaultProps={props}
          calculateMetadata={async ({ props: p }) => {
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
);
