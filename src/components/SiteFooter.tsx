import { spotPaths } from "../lib/blobs";
import styles from "./SiteFooter.module.css";

const LINKS = [
	{ label: "ssh", href: "/id_ecdsa.pub" },
	{ label: "source", href: "https://github.com/alula/alula.me" },
];

export function SiteFooter() {
	return (
		<footer className={styles.footer}>
			<svg
				className={styles.wave}
				viewBox="0 0 1440 60"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<path d="M0 30c120-40 240-40 360 0s240 40 360 0 240-40 360 0 240 40 360 0v30H0Z" />
			</svg>
			<span className={styles.glow} aria-hidden="true" />
			<span
				className={`${styles.glow} ${styles.glowB}`}
				aria-hidden="true"
			/>
			<span className={styles.patches} aria-hidden="true">
				<FurPatch seed={7} className={styles.patchA} />
				<FurPatch seed={19} className={styles.patchB} />
			</span>

			<div className={styles.inner}>
				<p className={styles.signoff}>alula.me</p>
				<ul className={styles.links}>
					{LINKS.map(({ label, href }) => (
						<li key={href}>
							<a href={href}>{label}</a>
						</li>
					))}
				</ul>
			</div>
		</footer>
	);
}

/** Cream fur marking, same ragged blobs as the page background. */
function FurPatch({ seed, className }: { seed: number; className: string }) {
	return (
		<svg
			viewBox="0 0 100 100"
			className={`${styles.patch} ${className}`}
			aria-hidden="true"
		>
			<g filter="url(#fur-edge)">
				{spotPaths(seed).map((d, i) => (
					<path key={i} d={d} />
				))}
			</g>
		</svg>
	);
}
