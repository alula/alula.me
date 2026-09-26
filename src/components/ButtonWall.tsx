import { MouseEvent, useState } from "react";
import webring from "virtual:webring";
import { Heart, Sparkle } from "./icons";
import styles from "./ButtonWall.module.css";

const buttonSrc = (name: string, imageFile?: string) =>
	`/webring/${imageFile || `${name}.png`}`;

/** 88x31s at their real size, crammed together like the bottom of a 2004 homepage. */
export function ButtonWall() {
	return (
		<ul className={styles.wall}>
			{webring.map(({ name, url, imageFile }) => (
				<li key={name}>
					<a href={url} target="_blank" rel="noreferrer" title={name}>
						<img
							src={buttonSrc(name, imageFile)}
							alt={name}
							width={88}
							height={31}
							loading="lazy"
						/>
					</a>
				</li>
			))}
		</ul>
	);
}

const LINK_BACK = `<a href="https://alula.me"><img src="https://alula.me/webring/alula.png" alt="alula" width="88" height="31"></a>`;

/** LINK_BACK again, split up for highlighting. */
function HighlightedSnippet() {
	const attr = (name: string, value: string) => (
		<>
			{" "}
			<span className={styles.attr}>{name}</span>=
			<span className={styles.str}>"{value}"</span>
		</>
	);
	return (
		<>
			<span className={styles.tag}>&lt;a</span>
			{attr("href", "https://alula.me")}
			<span className={styles.tag}>&gt;</span>
			<span className={styles.tag}>&lt;img</span>
			{attr("src", "https://alula.me/webring/alula.png")}
			{attr("alt", "alula")}
			{attr("width", "88")}
			{attr("height", "31")}
			<span className={styles.tag}>&gt;&lt;/a&gt;</span>
		</>
	);
}

export function LinkBack() {
	const [copied, setCopied] = useState(0);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(LINK_BACK);
			setCopied((n) => n + 1);
		} catch {
			// Clipboard blocked, clicking the snippet still selects it for a manual copy.
		}
	};

	const selectSnippet = (e: MouseEvent<HTMLElement>) => {
		const range = document.createRange();
		range.selectNodeContents(e.currentTarget);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	};

	return (
		<div className={`cel ${styles.linkBack}`}>
			<div className={styles.head}>
				<span className={styles.myButton}>
					<img
						src={buttonSrc("alula")}
						alt="alula.me 88x31 button"
						width={88}
						height={31}
					/>
				</span>
				<div>
					<h3 className={styles.title}>link to me!</h3>
					<p className={styles.sub}>hotlinking is fine :3</p>
				</div>
			</div>

			<div className={styles.snippet}>
				<code onClick={selectSnippet}>
					<HighlightedSnippet />
				</code>
				<button
					type="button"
					className={`glass ${styles.copy}`}
					onClick={copy}
					data-copied={copied ? "" : undefined}
				>
					{copied ? (
						<span key={copied} className={styles.copied}>
							copied! <Heart />
						</span>
					) : (
						"copy"
					)}
				</button>
			</div>
		</div>
	);
}
