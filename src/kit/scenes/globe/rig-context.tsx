import { createContext, useContext } from "react";
import type { GlobeRig } from "./rig";

/** Globe rigs by layer id, so 2D overlays can follow 3D points through the same camera. */
export const RigContext = createContext<Record<string, GlobeRig>>({});

export const useRig = (layerId: string) => {
  const rig = useContext(RigContext)[layerId];
  if (!rig) throw new Error(`No globe layer with id "${layerId}"`);
  return rig;
};
