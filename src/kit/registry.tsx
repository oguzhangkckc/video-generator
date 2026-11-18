import type { Video } from "../spec/resolve";
import type { Layer, LayerOf } from "../spec/schema";
import { CityMap } from "./scenes/city-map/CityMap";
import { Globe } from "./scenes/globe/Globe";
import { Haze } from "./transitions/Haze";
import { RingShrink } from "./transitions/RingShrink";
import { SignalPass } from "./transitions/SignalPass";
import { SpeedLines } from "./transitions/SpeedLines";

type LayerComponent<K extends Layer["type"]> = React.FC<{ layer: LayerOf<K>; video: Video }>;

/** Every layer type in src/spec/schema.ts must appear here; TypeScript enforces it. */
export const LAYERS: { [K in Layer["type"]]: LayerComponent<K> } = {
  globe: ({ layer }) => <Globe layer={layer} />,
  cityMap: ({ layer, video }) => <CityMap layer={layer} curve={video.curve} />,
  haze: ({ layer }) => <Haze layer={layer} />,
  speedLines: ({ layer }) => <SpeedLines layer={layer} />,
  signalPass: ({ layer }) => <SignalPass layer={layer} />,
  ringShrink: ({ layer }) => <RingShrink layer={layer} />,
};

export const LayerView: React.FC<{ layer: Layer; video: Video }> = ({ layer, video }) => {
  const Component = LAYERS[layer.type] as LayerComponent<Layer["type"]>;
  return <Component layer={layer as never} video={video} />;
};
