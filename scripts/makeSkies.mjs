// Regenerates src/assets/sky-*.webp, the hero skies:
//   node scripts/makeSkies.mjs
// Sources are the 2k equirect skies from freestylized.com, kept in ./scratch, whole:
// the stage projects them as the sphere they are (src/three/StageSky.ts), with the
// tone mapping and HDR expansion in its shader. For each there's also a still of
// the stage's view at rest, the sky until the stage runs (src/components/Sky.tsx).
import { execFileSync } from "node:child_process";
import { FORWARD_U, LENS_WIDEN, REST_FOV } from "../src/lib/skyLens.ts";

const SKIES = ["05", "06", "38"];
const SIZE = { width: 2048, height: 1024 };
// The still is rendered at about the canvas height, and wider than any hero frame
// gets for that height, so CSS can centre it without running out.
const STILL = { width: 2400, height: 1000 };

const decode = (c) =>
	c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const encode = (c) =>
	c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/**
 * The stage's sky shader at rest, on the CPU: a level camera looking down -z, the
 * panorama at the start of its pan, and SDR, since the still is a plain image.
 */
function renderStill(source) {
	const linear = new Float32Array(source.length);
	for (let i = 0; i < source.length; i++) linear[i] = decode(source[i] / 255);

	// bilinear like the GPU, wrapping around horizontally
	const sample = (u, v, out) => {
		const x = u * SIZE.width - 0.5;
		const y = Math.min(Math.max(v * SIZE.height - 0.5, 0), SIZE.height - 1);
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const fx = x - x0;
		const fy = y - y0;
		const y1 = Math.min(y0 + 1, SIZE.height - 1);
		const wrap = (xi) => ((xi % SIZE.width) + SIZE.width) % SIZE.width;
		const at = (xi, yi) => (yi * SIZE.width + wrap(xi)) * 3;
		const a = at(x0, y0);
		const b = at(x0 + 1, y0);
		const c = at(x0, y1);
		const d = at(x0 + 1, y1);
		for (let k = 0; k < 3; k++) {
			const top = linear[a + k] + (linear[b + k] - linear[a + k]) * fx;
			const bottom = linear[c + k] + (linear[d + k] - linear[c + k]) * fx;
			out[k] = top + (bottom - top) * fy;
		}
	};

	const still = Buffer.alloc(STILL.width * STILL.height * 3);
	const tan = Math.tan(((REST_FOV / 2) * Math.PI) / 180) * LENS_WIDEN;
	const rgb = [0, 0, 0];
	for (let j = 0; j < STILL.height; j++) {
		for (let i = 0; i < STILL.width; i++) {
			// the view ray, in units of half the height from the centre
			const rx = ((i + 0.5 - STILL.width / 2) / (STILL.height / 2)) * tan;
			const ry = (1 - (j + 0.5) / (STILL.height / 2)) * tan;
			const length = Math.hypot(rx, ry, 1);
			const u = FORWARD_U + Math.atan2(rx, 1) / (2 * Math.PI);
			const v = Math.acos(ry / length) / Math.PI;
			sample(u, v, rgb);

			// as the shader: ease saturation off a little, more in the highlights
			const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
			const t = Math.min(Math.max((y - 0.6) / 0.4, 0), 1);
			const ease = 0.1 + 0.25 * t * t * (3 - 2 * t);
			const o = (j * STILL.width + i) * 3;
			for (let k = 0; k < 3; k++) {
				const c = Math.min(
					Math.max(rgb[k] + (y - rgb[k]) * ease, 0),
					1,
				);
				still[o + k] = Math.round(encode(c) * 255);
			}
		}
	}
	return still;
}

for (const name of SKIES) {
	const source = `scratch/sky_${name}_2k.png`;
	const out = `src/assets/sky-${name}.webp`;
	execFileSync("magick", [
		source,
		// lossless: the shader magnifies them several times, which shows every artefact
		"-define",
		"webp:lossless=true",
		"-define",
		"webp:method=6",
		out,
	]);

	const pixels = execFileSync(
		"magick",
		[
			source,
			"-resize",
			`${SIZE.width}x${SIZE.height}!`,
			"-depth",
			"8",
			"rgb:-",
		],
		{ maxBuffer: SIZE.width * SIZE.height * 3 + 1024 },
	);
	const still = `src/assets/sky-${name}-placeholder.webp`;
	execFileSync(
		"magick",
		[
			"-size",
			`${STILL.width}x${STILL.height}`,
			"-depth",
			"8",
			"rgb:-",
			"-quality",
			"80",
			still,
		],
		{ input: renderStill(pixels) },
	);
	console.log(out, still);
}
