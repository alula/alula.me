import { Project, ProjectTag } from "../../app/lib/projects";
import { Reveal } from "./Reveal";
import { Arrow } from "./icons";
import styles from "./ProjectCard.module.css";

export const TAG_COLORS: Record<ProjectTag, string> = {
	rust: "#ffb37a",
	games: "#ffd86b",
	web: "#bfe2ff",
	discord: "#d3c7ff",
	port: "#ffc2c4",
	audio: "#a8e8c8",
	emulation: "#d3c7ff",
	"reverse-eng": "#ffb37a",
	ipv6: "#bfe2ff",
	hardware: "#ffd86b",
};

/** Which tinted HDR bloom (see scripts/makeHdrBlooms.mjs) goes with each tag colour. */
export const TAG_BLOOMS: Record<ProjectTag, string> = {
	rust: "orange",
	games: "yellow",
	web: "sky",
	discord: "lavender",
	port: "blush",
	audio: "mint",
	emulation: "lavender",
	"reverse-eng": "orange",
	ipv6: "sky",
	hardware: "yellow",
};

const TILTS = [-1.2, 0.8, -0.5, 1.1, -0.9, 0.6];

export function slugify(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

interface ProjectCardProps {
	project: Project;
	index: number;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
	const { name, url, description, tags } = project;
	const host = new URL(url).host.replace(/^www\./, "");
	const tilt = TILTS[index % TILTS.length];

	return (
		<Reveal
			as="article"
			index={index % 3}
			tilt={tilt * 2}
			className={`cel ${styles.card}`}
			// lets the /projects filter animate cards to their new spots
			style={{ viewTransitionName: `project-${slugify(name)}` }}
		>
			<h3 className={styles.name}>
				<a href={url} target="_blank" rel="noreferrer">
					{name}
				</a>
				<Arrow className={styles.arrow} />
			</h3>
			{description && <p className={styles.description}>{description}</p>}
			<p className={styles.meta}>
				<span>{host}</span>
				<span className={styles.tags}>{tags.join(" · ")}</span>
			</p>
		</Reveal>
	);
}
