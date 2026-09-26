import { SyntheticEvent, useEffect, useRef, useState } from "react";
import type { AlulaStage } from "../three/AlulaStage";
import { useReducedMotion } from "../lib/motion";
import { reportStageSupport } from "../lib/support";
import posterWide from "../assets/hero-wide.webp";
import posterNarrow from "../assets/hero-narrow.webp";
import posterWideDark from "../assets/hero-wide-dark.webp";
import posterNarrowDark from "../assets/hero-narrow-dark.webp";
import styles from "./AlulaModel.module.css";
import { Note } from "./icons";

const MODEL_URL = "/models/alula.vrm";
const DANCE_URL = "/dance/ievan_polkka.vmd.lz4";
const DANCE_AUDIO_URL = "/dance/ievan_polkka.opus";

// `?prerender` stops on frame 0 and hides the rest of the page, so scripts/prerenderHero.mjs
// can capture exactly what the live canvas starts with.
const PRERENDER = new URLSearchParams(window.location.search).has("prerender");

type DanceState = "off" | "loading" | "on" | "unavailable";

interface AlulaModelProps {
	className?: string;
}

// Posters fade in once decoded instead of popping in, see .poster[data-loaded].
function markLoaded(e: SyntheticEvent<HTMLImageElement>) {
	e.currentTarget.dataset.loaded = "";
}

// A cached poster can finish before React attaches onLoad.
function markIfLoaded(img: HTMLImageElement | null) {
	if (img?.complete && img.naturalWidth) img.dataset.loaded = "";
}

function hasWebGL() {
	try {
		return !!document.createElement("canvas").getContext("webgl2");
	} catch {
		return false;
	}
}

export function AlulaModel({ className }: AlulaModelProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const stageRef = useRef<AlulaStage | null>(null);
	const reduced = useReducedMotion();
	const [ready, setReady] = useState(false);
	const [dance, setDance] = useState<DanceState>("off");
	// set once the canvas is actually on screen, see the effect below the main one
	const shownRef = useRef(false);
	const syncRef = useRef<() => void>(() => {});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || reduced || !hasWebGL()) return;

		let stage: AlulaStage | null = null;
		let cancelled = false;
		let visible = true;

		// The loop only starts once the loaded scene is on screen: its first frames
		// ease out of the static poster state, and running any of them while still
		// hidden would reveal the canvas already part way into that blend.
		const sync = () => {
			if (!stage || !shownRef.current || PRERENDER) return;
			if (visible && !document.hidden) stage.start();
			else stage.stop();
		};
		syncRef.current = sync;

		const onPointerMove = (e: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			stage?.setPointer(
				((e.clientX - rect.left) / rect.width) * 2 - 1,
				((e.clientY - rect.top) / rect.height) * 2 - 1,
			);
		};

		const resizeObserver = new ResizeObserver(() => stage?.resize());
		const intersectionObserver = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			sync();
		});

		import("../three/AlulaStage")
			.then(async ({ AlulaStage }) => {
				if (cancelled) return;
				stage = new AlulaStage({
					canvas,
					modelUrl: MODEL_URL,
					danceUrl: DANCE_URL,
					danceAudioUrl: DANCE_AUDIO_URL,
					sky: !PRERENDER,
				});
				stageRef.current = stage;
				await stage.load();
				if (cancelled) return;
				reportStageSupport(stage.support);
				setReady(true);
				if (PRERENDER) document.documentElement.dataset.prerender = "";
			})
			.catch((e) =>
				console.warn("failed to load, keeping the prerender", e),
			);

		resizeObserver.observe(canvas);
		intersectionObserver.observe(canvas);
		window.addEventListener("pointermove", onPointerMove, {
			passive: true,
		});
		document.addEventListener("visibilitychange", sync);

		return () => {
			cancelled = true;
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
			window.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("visibilitychange", sync);
			stage?.dispose();
			stageRef.current = null;
			shownRef.current = false;
			setReady(false);
			setDance("off");
		};
	}, [reduced]);

	// Runs after React has committed data-ready, i.e. once the canvas is showing.
	useEffect(() => {
		shownRef.current = ready;
		if (ready) syncRef.current();
	}, [ready]);

	const toggleDance = async () => {
		const stage = stageRef.current;
		if (!stage || dance === "loading") return;
		const next = dance !== "on";
		if (next) setDance("loading");
		const ok = await stage.setDancing(next);
		setDance(next ? (ok ? "on" : "unavailable") : "off");
	};

	return (
		<div
			className={`${styles.model} ${className ?? ""}`}
			data-ready={ready ? "" : undefined}
			data-dancing={dance === "on" ? "" : undefined}
		>
			<picture>
				<source
					media="(prefers-color-scheme: dark)"
					srcSet={posterWideDark}
				/>
				<img
					className={`${styles.poster} ${styles.posterWide}`}
					ref={markIfLoaded}
					onLoad={markLoaded}
					src={posterWide}
					width={1136}
					height={871}
				/>
			</picture>
			<picture>
				<source
					media="(prefers-color-scheme: dark)"
					srcSet={posterNarrowDark}
				/>
				<img
					className={`${styles.poster} ${styles.posterNarrow}`}
					ref={markIfLoaded}
					onLoad={markLoaded}
					src={posterNarrow}
					width={358}
					height={622}
				/>
			</picture>
			<canvas
				ref={canvasRef}
				className={styles.canvas}
				data-stage=""
				role="img"
			/>
			{ready && dance !== "unavailable" && (
				<button
					type="button"
					className={styles.danceButton}
					onClick={toggleDance}
					aria-pressed={dance === "on"}
					aria-label={
						dance === "on" ? "Stop dancing" : "Make her dance"
					}
					title={dance === "on" ? "ok stop" : "make her dance"}
					data-state={dance}
				>
					<span className={styles.note} aria-hidden="true">
						<Note width="1em" height="1em" />
					</span>
				</button>
			)}
		</div>
	);
}
