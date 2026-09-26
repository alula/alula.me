// Regenerates src/assets/hdr-bloom-*.png, the tinted HDR blooms for .glass buttons:
//   node scripts/makeHdrBlooms.mjs
// Each colour goes sRGB -> linear BT.2020, is boosted to BRIGHTNESS x itself plus a
// small neutral LIFT (so near-black buttons still visibly brighten instead of
// staying black), relative to SDR white at 203 nits, PQ encoded, and written as an
// 8-bit PNG tagged with the PQ ICC profile (scripts/icc, from hdrify). A brighter
// version of the button's own colour rather than white, the way iOS bumps
// luminance on press.
import { execFileSync } from "node:child_process";

const icc = "scripts/icc/BT2100-PQ.icc";
const BRIGHTNESS = 2.5;
const LIFT = 0.08;
const SDR_WHITE = 203;

const COLORS = {
	white: "#ffffff",
	orange: "#ff8a3d",
	yellow: "#ffc94a",
	sky: "#bfe2ff",
	blush: "#ffc2c4",
	mint: "#a8e8c8",
	lavender: "#d3c7ff",
	telegram: "#26a5e4",
	bluesky: "#1185fe",
	discord: "#5865f2",
	fluxer: "#4641d9",
	github: "#24292f",
	x: "#000000",
	// the dark mode panel, so untinted glass brightens instead of going white
	night: "#3b2426",
	// not a bloom: fill for the dark mode "alula" in the hero heading. Only a touch
	// past paper white, but pushed past sRGB saturation into BT.2020 for vibrancy
	"accent-text": {
		hex: "#ff8a3d",
		brightness: 1.35,
		lift: 0,
		saturation: 1.3,
	},
	// likewise for the dark mode page titles: the cream ink, a little past paper white
	"ink-text": { hex: "#fff0e3", brightness: 1.3, lift: 0 },
};

const toLinear = (c) =>
	c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

// BT.709 primaries -> BT.2020 primaries, both linear.
const M = [
	[0.6274, 0.3293, 0.0433],
	[0.0691, 0.9195, 0.0114],
	[0.0164, 0.088, 0.8956],
];

function pq(nits) {
	const m1 = 0.1593017578125,
		m2 = 78.84375,
		c1 = 0.8359375,
		c2 = 18.8515625,
		c3 = 18.6875;
	const y = Math.pow(Math.min(Math.max(nits, 0), 10000) / 10000, m1);
	return Math.pow((c1 + c2 * y) / (1 + c3 * y), m2);
}

for (const [name, entry] of Object.entries(COLORS)) {
	const {
		hex,
		brightness = BRIGHTNESS,
		lift = LIFT,
		saturation = 1,
	} = typeof entry === "string" ? { hex: entry } : entry;
	const srgb = [1, 3, 5].map((i) =>
		toLinear(parseInt(hex.slice(i, i + 2), 16) / 255),
	);
	let rec2020 = M.map((row) =>
		row.reduce((sum, m, i) => sum + m * srgb[i], 0),
	);
	// scale chroma around BT.2020 luminance, which can leave the sRGB gamut
	const y = 0.2627 * rec2020[0] + 0.678 * rec2020[1] + 0.0593 * rec2020[2];
	rec2020 = rec2020.map((v) => Math.max(y + (v - y) * saturation, 0));
	const code = rec2020.map((v) =>
		Math.round(pq((v * brightness + lift) * SDR_WHITE) * 255),
	);
	execFileSync("magick", [
		"-size",
		"4x4",
		`xc:rgb(${code.join(",")})`,
		"-profile",
		icc,
		// no timestamps, so reruns give the same files
		"-define",
		"png:exclude-chunks=date,time",
		`PNG24:src/assets/hdr-bloom-${name}.png`,
	]);
	console.log(name, hex, "->", code.join(","));
}
