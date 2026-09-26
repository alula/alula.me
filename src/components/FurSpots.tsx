import { useEffect, useRef } from "react";
import { cssVars } from "../lib/css";
import { spotPaths } from "../lib/blobs";
import { prefersReducedMotion } from "../lib/motion";
import styles from "./FurSpots.module.css";

interface Spot {
	/**
	 * Distance from the top of the page in lvh. Viewport based, not a % of the page,
	 * so spots don't jump around when the content changes height. Short pages just
	 * clip the ones further down.
	 */
	top: number;
	left: number;
	/** Width in vw, clamped in CSS so phones still get chunky spots. */
	size: number;
	seed: number;
	tone: "fur" | "light";
	/** Parallax strength, 0 sticks to the page. */
	depth: number;
}

const SPOTS: Spot[] = [
	{ top: 4, left: -6, size: 26, seed: 3, tone: "fur", depth: 0.12 },
	{ top: 14, left: 84, size: 18, seed: 11, tone: "light", depth: 0.2 },
	{ top: 60, left: 90, size: 24, seed: 5, tone: "fur", depth: 0.08 },
	{ top: 85, left: -4, size: 14, seed: 21, tone: "light", depth: 0.18 },
	{ top: 115, left: 44, size: 11, seed: 8, tone: "fur", depth: 0.25 },
	{ top: 145, left: 78, size: 20, seed: 14, tone: "light", depth: 0.1 },
	{ top: 165, left: -8, size: 22, seed: 2, tone: "fur", depth: 0.15 },
	{ top: 205, left: 88, size: 16, seed: 17, tone: "fur", depth: 0.22 },
	{ top: 225, left: 20, size: 12, seed: 9, tone: "light", depth: 0.12 },
	{ top: 255, left: 60, size: 25, seed: 26, tone: "light", depth: 0.06 },
	{ top: 285, left: -5, size: 17, seed: 13, tone: "fur", depth: 0.2 },
	{ top: 320, left: 82, size: 21, seed: 6, tone: "fur", depth: 0.1 },
];

export function FurSpots() {
	const layerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const layer = layerRef.current;
		if (!layer || prefersReducedMotion()) return;

		let frame = 0;
		const update = () => {
			frame = 0;
			layer.style.setProperty("--scroll", String(window.scrollY));
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		update();
		return () => {
			window.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(frame);
		};
	}, []);

	return (
		<div ref={layerRef} className={styles.layer} aria-hidden="true">
			<FurEdgeFilter />
			{SPOTS.map((spot, i) => (
				<FurSpot key={i} spot={spot} index={i} />
			))}
		</div>
	);
}

/** Ragged, painted edges instead of perfect vector curves. Also used by the cards. */
function FurEdgeFilter() {
	return (
		<svg className={styles.defs}>
			<filter id="fur-edge" x="-10%" y="-10%" width="120%" height="120%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.09"
					numOctaves="2"
					seed="4"
				/>
				<feDisplacementMap in="SourceGraphic" scale="3.2" />
			</filter>
		</svg>
	);
}

function FurSpot({ spot, index }: { spot: Spot; index: number }) {
	// alternate spin direction and vary speed so they don't breathe in lockstep
	const style = cssVars({
		"--top": `${spot.top}lvh`,
		"--left": `${spot.left}%`,
		"--size": spot.size,
		"--depth": spot.depth,
		"--spin": `${(index % 2 ? 1 : -1) * (4 + (index % 4) * 2)}deg`,
		"--dur": `${14 + (index % 5) * 3}s`,
	});
	return (
		<svg
			viewBox="0 0 100 100"
			className={styles.spot}
			data-tone={spot.tone}
			style={style}
		>
			<g filter="url(#fur-edge)">
				{spotPaths(spot.seed).map((d, j) => (
					<path key={j} d={d} />
				))}
			</g>
		</svg>
	);
}
