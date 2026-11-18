import { random } from "remotion";

const DEG = Math.PI / 180;

type Layout = {
  water: { d: string; width: number }[];
  avenues: string[];
  bridges: [number, number, number, number][];
};

// Abstract shapes only — no real map data. The strait and inlet merely hint at a coastal city.
export const LAYOUTS: Record<"coastal-strait", Layout> = {
  "coastal-strait": {
    water: [
      { d: "M 250 -2600 C 520 -1500, 60 -760, 360 -220 S 660 900, 390 1500 S 560 2150, 650 2700", width: 300 },
      { d: "M 330 -300 C 90 -420, -320 -470, -820 -760", width: 110 },
    ],
    avenues: [
      "M -2300 300 C -1400 160, -600 -60, 260 -40",
      "M -400 -2300 C -300 -1200, -160 -400, -40 0 S 120 1200, -200 2300",
      "M -2200 -1500 C -1300 -900, -700 -700, 240 -900",
      "M 640 -1800 C 900 -900, 1400 -200, 2300 200",
      "M 600 700 C 1200 900, 1700 1300, 2300 1500",
      "M -2000 1600 C -1200 1200, -600 900, 360 700",
    ],
    bridges: [
      [60, -880, 640, -930],
      [160, 560, 740, 610],
    ],
  },
};

type District = { cx: number; cy: number; rot: number; w: number; h: number; gap: number };
type LightBucket = { d: string; width: number; opacity: number };

/** Street grids and street lights for ~17 districts around the centre; deterministic per seed. */
export const buildCity = (seed?: string) => {
  const rnd = (key: string) => random(seed ? `${seed}:${key}` : key);
  const districts: District[] = [{ cx: -80, cy: 40, rot: 12 * DEG, w: 1100, h: 1000, gap: 80 }];
  for (let i = 0; i < 16; i++) {
    const angle = rnd(`d-a-${i}`) * Math.PI * 2;
    const dist = 300 + Math.sqrt(rnd(`d-r-${i}`)) * 1700;
    districts.push({
      cx: Math.cos(angle) * dist,
      cy: Math.sin(angle) * dist,
      rot: (rnd(`d-rot-${i}`) - 0.5) * 70 * DEG,
      w: 500 + rnd(`d-w-${i}`) * 700,
      h: 500 + rnd(`d-h-${i}`) * 700,
      gap: 70 + rnd(`d-g-${i}`) * 50,
    });
  }

  let streets = "";
  const lights: LightBucket[] = [
    { d: "", width: 3.2, opacity: 0.95 },
    { d: "", width: 4.6, opacity: 0.7 },
    { d: "", width: 6.4, opacity: 0.45 },
  ];

  districts.forEach((d, i) => {
    const cos = Math.cos(d.rot);
    const sin = Math.sin(d.rot);
    const w2 = d.w / 2;
    const h2 = d.h / 2;
    const p = (lx: number, ly: number) =>
      `${(d.cx + lx * cos - ly * sin).toFixed(1)} ${(d.cy + lx * sin + ly * cos).toFixed(1)}`;
    const snap = (v: number, half: number) => Math.round((v + half) / d.gap) * d.gap - half;

    for (let x = -w2; x <= w2; x += d.gap) streets += `M ${p(x, -h2)} L ${p(x, h2)} `;
    for (let y = -h2; y <= h2; y += d.gap) streets += `M ${p(-w2, y)} L ${p(w2, y)} `;

    const count = Math.round(((d.w * d.h) / (d.gap * d.gap)) * 0.55);
    for (let k = 0; k < count; k++) {
      const onVertical = rnd(`l-v-${i}-${k}`) < 0.5;
      const rx = (rnd(`l-x-${i}-${k}`) - 0.5) * d.w;
      const ry = (rnd(`l-y-${i}-${k}`) - 0.5) * d.h;
      const lx = onVertical ? snap(rx, w2) : rx;
      const ly = onVertical ? ry : snap(ry, h2);
      lights[Math.floor(rnd(`l-b-${i}-${k}`) * lights.length)].d += `M ${p(lx, ly)} l 0.01 0 `;
    }
  });

  return { streets, lights };
};
