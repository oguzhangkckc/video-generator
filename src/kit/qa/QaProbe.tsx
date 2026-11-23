import { useEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Video } from "../../spec/resolve";
import { sceneFindings } from "../../spec/scenes";

import { useLayout } from "../layout";
import { overlayBoxes, reservedZones } from "../overlays/boxes";

export type { QaBox } from "../overlays/boxes";

/**
 * QA mode only: logs, for scripts/qa.mjs, the overlay boxes of this frame (QA_BOXES), the reserved zones the camera
 * keeps clear and what each scene drew (QA_SCENE), and the resolved soundtrack, phrases and labels (QA_SPEC).
 */
export const QaProbe: React.FC<{ video: Video }> = ({ video }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();
  useEffect(() => {
    const t = frame / fps;
    console.log(`QA_BOXES ${JSON.stringify({ t, boxes: overlayBoxes(video, t, layout) })}`);
    console.log(`QA_SCENE ${JSON.stringify({ t, zones: reservedZones(video, t, layout) })}`);
    const { sound, durationSec, labels } = video.spec;
    const shown = labels.map(({ text, at }) => ({ text, at }));
    const findings = sceneFindings(video.spec);
    console.log(`QA_SPEC ${JSON.stringify({ sound, durationSec, phrases: video.phrases, labels: shown, findings, transitions: video.spec.transitions })}`);
  }, [frame, fps, video, layout]);
  return null;
};
