import { RefObject, useEffect, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotion() {
	return useSyncExternalStore((onChange) => {
		const mql = window.matchMedia(REDUCED_MOTION_QUERY);
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, prefersReducedMotion);
}

export function useInView<T extends Element>(
	ref: RefObject<T | null>,
	{ once = true, rootMargin = "0px 0px -12% 0px" } = {},
) {
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setInView(entry.isIntersecting);
				if (entry.isIntersecting && once) observer.disconnect();
			},
			{ rootMargin },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref, once, rootMargin]);

	return inView;
}

const SCRAMBLE_GLYPHS = "0123456789ABCDEF<>/\\_=+*#@";

/**
 * Decodes `text` out of hex-ish noise once `active` flips on, like a memory
 * viewer settling. Spaces are kept so the line length never jumps around.
 */
export function useScramble(text: string, active: boolean, duration = 900) {
	const [output, setOutput] = useState(() => text.replace(/\S/g, " "));
	const reduced = useReducedMotion();

	useEffect(() => {
		if (!active) return;
		if (reduced) {
			setOutput(text);
			return;
		}

		let frame = 0;
		const start = performance.now();
		const tick = (now: number) => {
			const progress = Math.min((now - start) / duration, 1);
			const settled = Math.floor(progress * text.length);
			let next = text.slice(0, settled);
			for (let i = settled; i < text.length; i++) {
				const ch = text[i];
				next +=
					ch === " "
						? " "
						: SCRAMBLE_GLYPHS[
								(Math.random() * SCRAMBLE_GLYPHS.length) | 0
							];
			}
			setOutput(next);
			if (progress < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [text, active, duration, reduced]);

	return output;
}
