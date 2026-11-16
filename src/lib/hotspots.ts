import type { Product } from "./catalog";
import { prettyRes } from "./specs";
import type { Hotspot } from "@/components/Projector3D";

export const shapeFor = (kind: string) => (kind === "projector-ust" ? "ust" : kind === "projector-portable" ? "portable" : "standard") as "standard" | "ust" | "portable";

/** 3D hotspots are generated from the product's own spec fields — nothing is shown that the spec sheet does not say. */
export function hotspotsFor(p: Pick<Product, "kind" | "specs">): Hotspot[] {
  const s = p.specs, shape = shapeFor(p.kind), out: Hotspot[] = [];
  const pos: Record<string, Record<string, [number, number, number]>> = {
    standard: { lens: [-0.62, 0.02, 1.2], light: [0.75, 0.62, -0.3], ports: [0, -0.05, -1.1], audio: [1.4, 0, 0] },
    ust: { lens: [0, 0.5, 0.2], light: [-1.2, 0.4, 0], ports: [1.2, 0, -0.9], audio: [0, 0, 0.95] },
    portable: { lens: [0, 0.32, 0.9], light: [0, 1.3, 0], ports: [0.6, -0.2, -0.6], audio: [-0.85, -0.5, 0] },
  };
  const at = pos[shape];
  if (s.native_resolution) out.push({ id: "lens", label: "Optics", body: `Native resolution ${prettyRes(s.native_resolution)}${s.projection_size ? ` · projects ${s.projection_size}` : ""}${s.throw_ratio ? ` · throw ratio ${s.throw_ratio}` : ""}`, position: at.lens });
  if (s.light_source) out.push({ id: "light", label: "Light source", body: `${s.light_source}${s.brightness_value ? ` · ${s.brightness_value.toLocaleString("en-ZA")} ${s.brightness_unit}` : ""}${s.light_source_life ? ` · ${s.light_source_life}` : ""}`, position: at.light });
  if (s.connectivity?.length) out.push({ id: "ports", label: "Connections", body: s.connectivity.join(" · "), position: at.ports });
  if (s.speakers) out.push({ id: "audio", label: "Built-in sound", body: `${s.speakers}${s.battery ? ` · Battery: ${s.battery}` : ""}`, position: at.audio });
  return out;
}
