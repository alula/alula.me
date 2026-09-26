import { ReactNode, useEffect, useState } from "react";
import { useScramble } from "../lib/motion";
import { Sparkle } from "./icons";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
	kicker: string;
	title: string;
	children?: ReactNode;
}

export function PageHeader({ kicker, title, children }: PageHeaderProps) {
	const [active, setActive] = useState(false);
	const scrambled = useScramble(title, active, 700);

	useEffect(() => {
		const id = requestAnimationFrame(() => setActive(true));
		return () => cancelAnimationFrame(id);
	}, []);

	return (
		<header className={styles.header}>
			<p className={styles.kicker}>{kicker}</p>
			<h1 className={styles.title}>
				{[...title].map((char, i) => (
					<DecodingChar key={i} char={char} shown={scrambled[i]} />
				))}
				<Sparkle className={styles.sparkle} />
			</h1>
			{children && <div className={styles.intro}>{children}</div>}
		</header>
	);
}

/**
 * The real character always sets the layout, so the heading keeps its final
 * width and line breaks while it decodes. Until it settles the real one is
 * transparent and the scrambled glyph floats over it, centred.
 */
function DecodingChar({ char, shown }: { char: string; shown: string }) {
	if (char === " ") return " ";
	const settled = shown === char;

	return (
		<span className={styles.char} data-settled={settled ? "" : undefined}>
			{char}
			{!settled && (
				<span className={styles.glyph} aria-hidden="true">
					{shown}
				</span>
			)}
		</span>
	);
}
