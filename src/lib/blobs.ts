// Organic fur-spot shapes, shared by the background and the project cards.

// Small deterministic PRNG so the spots don't reshuffle on every render.
export function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Closed, lumpy blob through `lobes` random points, smoothed with Catmull-Rom. */
export function blobPath(
	rand: () => number,
	cx: number,
	cy: number,
	radius: number,
	lobes: number,
) {
	const points = Array.from({ length: lobes }, (_, i) => {
		const angle = (i / lobes) * Math.PI * 2 + (rand() - 0.5) * 0.6;
		const r = radius * (0.62 + rand() * 0.38);
		return [
			cx + Math.cos(angle) * r,
			cy + Math.sin(angle) * r * (0.8 + rand() * 0.25),
		];
	});

	const at = (i: number) => points[(i + lobes) % lobes];
	let d = `M${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
	for (let i = 0; i < lobes; i++) {
		const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
		const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += ` C${c1.map((n) => n.toFixed(1)).join(" ")} ${c2.map((n) => n.toFixed(1)).join(" ")} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
	}
	return d + "Z";
}

/** One big patch plus a few speckles drifting off it, like the ones on her ears. */
export function spotPaths(seed: number) {
	const rand = mulberry32(seed);
	const paths = [blobPath(rand, 50, 50, 34, 7 + Math.floor(rand() * 3))];
	const speckles = 2 + Math.floor(rand() * 3);
	for (let i = 0; i < speckles; i++) {
		const angle = rand() * Math.PI * 2;
		const dist = 38 + rand() * 9;
		paths.push(
			blobPath(
				rand,
				50 + Math.cos(angle) * dist,
				50 + Math.sin(angle) * dist,
				3 + rand() * 4,
				5,
			),
		);
	}
	return paths;
}
