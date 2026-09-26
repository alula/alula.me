import { cssVars } from "../lib/css";
import { Sky } from "./Sky";
import { socials } from "../lib/socials";
import { AlulaModel } from "./AlulaModel";
import styles from "./Hero.module.css";

export function Hero() {
	return (
		<section className={styles.hero} aria-labelledby="hero-title">
			<div className={styles.frame}>
				<Sky />
				<AlulaModel className={styles.model} />
			</div>
			<SpeechBubble />
		</section>
	);
}

function SpeechBubble() {
	return (
		<div className={`cel ${styles.bubble}`}>
			<svg
				className={styles.tail}
				viewBox="0 0 20 40"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<path d="M0 0 20 20 0 40Z" />
				<path d="M0 0 20 20 0 40" />
			</svg>
			<p className={styles.kicker}>// hello world</p>
			<h1 id="hero-title">
				hi, i'm <span className={styles.name}>alula</span>!
			</h1>
			<p className={styles.bio}>
				I like messing with computers and I often program or reverse
				engineer things.
			</p>
			<ul className={styles.socials}>
				{socials.map((social, i) => (
					<SocialLink key={social.name} {...social} index={i} />
				))}
			</ul>
		</div>
	);
}

interface SocialLinkProps {
	name: string;
	url: string;
	brand: string;
	bloom: string;
	index: number;
}

function SocialLink({ name, url, brand, bloom, index }: SocialLinkProps) {
	const style = cssVars({
		"--i": index,
		"--brand": brand,
		"--brand-bloom": `var(--bloom-${bloom})`,
	});
	return (
		<li style={style}>
			<a className="glass" href={url} target="_blank" rel="noreferrer">
				{name}
			</a>
		</li>
	);
}
