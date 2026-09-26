import { CSS_FEATURES, useHdrDisplay, useStageSupport } from "../lib/support";
import styles from "./SupportWarnings.module.css";

/** Compiler style warnings for whatever this browser or screen can't show. */
export function SupportWarnings() {
	const hdrDisplay = useHdrDisplay();
	const stage = useStageSupport();

	const warnings: string[] = [];
	if (!hdrDisplay) warnings.push("best on an HDR display");
	if (stage?.webgpuError) warnings.push(`no WebGPU: ${stage.webgpuError}`);
	if (hdrDisplay && stage && !stage.hdr) warnings.push("no HDR canvas");
	const missing = CSS_FEATURES.filter(
		({ test, hdrOnly }) => (!hdrOnly || hdrDisplay) && !CSS.supports(test),
	).map(({ name }) => name);
	if (missing.length) warnings.push(`no ${missing.join(", ")}`);
	if (!warnings.length) return null;

	return (
		<aside className={styles.warnings} aria-label="Browser support">
			{warnings.map((warning) => (
				<p key={warning}>
					<span className={styles.label}>warning:</span> {warning}
				</p>
			))}
		</aside>
	);
}
