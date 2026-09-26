import { useSyncExternalStore } from "react";
import { currentSky, onSkyChange } from "../lib/skies";
import styles from "./Sky.module.css";

/**
 * The hero sky as a still image, until the 3D stage draws the live one over it
 * (three/StageSky.ts), or for good when there's no stage.
 */
export function Sky({ className }: { className?: string }) {
	const { placeholder } = useSyncExternalStore(onSkyChange, currentSky);
	return (
		<div
			className={`${styles.sky} ${className ?? ""}`}
			style={{ backgroundImage: `url(${placeholder})` }}
			aria-hidden="true"
		/>
	);
}
