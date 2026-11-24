import type { Video } from "../spec/resolve";
import { layerName } from "../spec/scenes";
import type { Layer, LayerOf } from "../spec/schema";
import { CityMap } from "./scenes/city-map/CityMap";
import { Flow } from "./scenes/flow/Flow";
import { Globe } from "./scenes/globe/Globe";
import { Model3D } from "./scenes/model3d/Model3D";
import { Trace } from "./scenes/trace/Trace";
import { Haze } from "./transitions/Haze";
import { RingShrink } from "./transitions/RingShrink";
import { SignalPass } from "./transitions/SignalPass";
import { SpeedLines } from "./transitions/SpeedLines";

/** `name` keys the layer in qa reports: its id, else type#index. */
type LayerComponent<K extends Layer["type"]> = React.FC<{ layer: LayerOf<K>; video: Video; name: string }>;

/** Every layer type in src/spec/schema.ts must appear here; TypeScript enforces it. */
export const LAYERS: { [K in Layer["type"]]: LayerComponent<K> } = {
  globe: ({ layer, name }) => <Globe layer={layer} name={name} />,
  cityMap: ({ layer, video, name }) => <CityMap layer={layer} curve={video.curve} name={name} />,
  model3d: ({ layer, name }) => <Model3D layer={layer} name={name} />,
  flow: ({ layer, video, name }) => <Flow layer={layer} curve={video.curve} name={name} />,
  trace: ({ layer, video, name }) => <Trace layer={layer} curve={video.curve} name={name} />,
  haze: ({ layer }) => <Haze layer={layer} />,
  speedLines: ({ layer }) => <SpeedLines layer={layer} />,
  signalPass: ({ layer }) => <SignalPass layer={layer} />,
  ringShrink: ({ layer }) => <RingShrink layer={layer} />,
};

export const LayerView: React.FC<{ layer: Layer; video: Video; index: number }> = ({ layer, video, index }) => {
  const Component = LAYERS[layer.type] as LayerComponent<Layer["type"]>;
  return <Component layer={layer as never} video={video} name={layerName(layer, index)} />;
};
