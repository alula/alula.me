import { useEffect } from "react";

/** Feeds the pointer position into whichever .glass element it's over, for the specular highlight. */
export function useGlassPointer() {
	useEffect(() => {
		const onMove = (e: PointerEvent) => {
			const el = (e.target as Element | null)?.closest?.<HTMLElement>(
				".glass",
			);
			if (!el) return;
			const rect = el.getBoundingClientRect();
			el.style.setProperty(
				"--gx",
				`${((e.clientX - rect.left) / rect.width) * 100}%`,
			);
			el.style.setProperty(
				"--gy",
				`${((e.clientY - rect.top) / rect.height) * 100}%`,
			);
		};
		document.addEventListener("pointermove", onMove, { passive: true });
		return () => document.removeEventListener("pointermove", onMove);
	}, []);
}
