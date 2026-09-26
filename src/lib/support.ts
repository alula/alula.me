// What the browser and screen can do of what the site uses, for the warnings on the
// home page. The 3D stage reports its own part once it has a renderer.
import { useSyncExternalStore } from "react";

export interface StageSupport {
	/** Why three fell back to WebGL 2, or null when it runs on WebGPU. */
	webgpuError: string | null;
	/** Whether values past 1.0 reach the screen as HDR. */
	hdr: boolean;
}

let stage: StageSupport | null = null;
const listeners = new Set<() => void>();

export function reportStageSupport(support: StageSupport) {
	stage = support;
	for (const listener of listeners) listener();
}

/** The stage's report, null until it has one, or when it doesn't run at all. */
export function useStageSupport() {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => stage,
	);
}

const HDR_QUERY = "(dynamic-range: high)";

export function useHdrDisplay() {
	return useSyncExternalStore(
		(listener) => {
			const mql = window.matchMedia(HDR_QUERY);
			mql.addEventListener("change", listener);
			return () => mql.removeEventListener("change", listener);
		},
		() => window.matchMedia(HDR_QUERY).matches,
	);
}

/** CSS the site leans on, as CSS.supports() conditions. */
export const CSS_FEATURES = [
	{ name: "corner-shape", test: "(corner-shape: squircle)" },
	{
		name: "backdrop-filter",
		test: "(backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))",
	},
	{ name: "display-p3", test: "(color: color(display-p3 1 0 0))" },
	{ name: "container queries", test: "(container-type: size)" },
	{
		name: "dynamic-range-limit",
		test: "(dynamic-range-limit: no-limit)",
		hdrOnly: true,
	},
];
