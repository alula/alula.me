// The hero skies, drawn behind her by the 3D stage (three/StageSky.ts), which also
// lights her to match whatever part of the panorama is on screen.
import daySky from "../assets/sky-05.webp";
import daySkyPlaceholder from "../assets/sky-05-placeholder.webp";
import duskSky from "../assets/sky-06.webp";
import duskSkyPlaceholder from "../assets/sky-06-placeholder.webp";
import { FORWARD_U } from "./skyLens";

export interface SkyPreset {
	image: string;
	/**
	 * The view at rest, prerendered by scripts/makeSkies.mjs: the sky until the stage
	 * runs, and without it.
	 */
	placeholder: string;
	/** Horizontal position of the sun in the panorama (0..1), null when none shows. */
	sunU: number | null;
	/** Sun height above the horizon, as the y of a unit-ish direction. */
	sunElevation: number;
	key: { color: string; intensity: number };
	/** Hemisphere ambient, picked from the sky and horizon colours. */
	ambient: { sky: string; ground: string; intensity: number };
	/**
	 * Linear luminance range where the HDR sky shader ramps highlights up past paper
	 * white. Starts just above the plain sky, ends at the brightest clouds.
	 */
	highlights: [number, number];
}

export const SKIES = {
	day: {
		image: daySky,
		placeholder: daySkyPlaceholder,
		sunU: null,
		sunElevation: 1.4,
		key: { color: "#fff3e4", intensity: 2.1 },
		ambient: { sky: "#cfe2f7", ground: "#e9dccf", intensity: 1.6 },
		// blue sky sits around 0.66, clouds reach 0.9
		highlights: [0.5, 0.93],
	},
	dusk: {
		image: duskSky,
		placeholder: duskSkyPlaceholder,
		sunU: 0.593,
		sunElevation: 0.3,
		key: { color: "#ffac78", intensity: 2.6 },
		ambient: { sky: "#9a74d4", ground: "#e28a78", intensity: 1.6 },
		// the sky body is around 0.3, the sun glow and lit cloud edges reach 0.8
		highlights: [0.1, 0.34],
	},
} satisfies Record<string, SkyPreset>;

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function currentSky(): SkyPreset {
	return window.matchMedia(DARK_QUERY).matches ? SKIES.dusk : SKIES.day;
}

export function onSkyChange(callback: () => void) {
	const mql = window.matchMedia(DARK_QUERY);
	mql.addEventListener("change", callback);
	return () => mql.removeEventListener("change", callback);
}

/** One full turn of the panorama. */
export const PAN_SECONDS = 240;

// When the pan started. Not page load: the sky first shows as a still image at
// offset 0 (Sky.tsx), and the stage has to pick up from exactly there.
let panOrigin: number | null = null;

/** Starts the pan clock, once the stage has taken over from the still sky. */
export function startSkyPan() {
	panOrigin ??= performance.now();
}

/** How far the panorama has panned (0..1). */
export function skyOffset(animate: boolean) {
	if (!animate || panOrigin === null) return 0;
	return ((performance.now() - panOrigin) / 1000 / PAN_SECONDS) % 1;
}

/**
 * World-space sun direction for the panorama panned by `offset`. The sky is a
 * sphere around her, so a sun ahead of the camera backlights her and one behind
 * it lights her face.
 */
export function sunDirection(
	sky: SkyPreset,
	offset: number,
	out: { x: number; y: number; z: number },
) {
	if (sky.sunU === null) {
		// no sun in view: soft light from the upper front left
		out.x = -0.6;
		out.y = sky.sunElevation;
		out.z = 1.6;
		return out;
	}
	const angle = (sky.sunU - FORWARD_U - offset) * Math.PI * 2;
	out.x = Math.sin(angle);
	out.y = sky.sunElevation;
	out.z = -Math.cos(angle);
	return out;
}
