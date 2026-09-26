import { createFileRoute } from "@tanstack/react-router";
import { ReactNode, useState } from "react";
import { flushSync } from "react-dom";
import styles from "../projects.module.css";
import { ProjectTag, projects } from "../../app/lib/projects";
import { cssVars } from "../lib/css";
import { PageHeader } from "../components/PageHeader";
import { ProjectCard, TAG_BLOOMS, TAG_COLORS } from "../components/ProjectCard";

export const Route = createFileRoute("/projects")({
	component: Projects,
});

const TAGS = (Object.keys(TAG_COLORS) as ProjectTag[]).filter((tag) =>
	projects.some((p) => p.tags.includes(tag)),
);

function Projects() {
	const [filter, setFilter] = useState<ProjectTag | null>(null);
	const shown = filter
		? projects.filter((p) => p.tags.includes(filter))
		: projects;

	// Cards carry view-transition names, so a filter change animates the reshuffle.
	// (Page-to-page transitions are off, they lagged and glitched.)
	const pick = (tag: ProjectTag | null) => {
		const next = tag === filter ? null : tag;
		if (!document.startViewTransition) {
			setFilter(next);
			return;
		}
		document.startViewTransition(() => flushSync(() => setFilter(next)));
	};

	return (
		<main>
			<PageHeader kicker="// ls ~/projects" title="stuff i've worked on">
				<p>
					I've worked on a lot of stuff, but here's a small selection
					of what I can link or I'm comfortable sharing (presented in
					no particular order).
				</p>
			</PageHeader>

			<div className={styles.body}>
				<div
					className={styles.filters}
					role="group"
					aria-label="Filter by tag"
				>
					<FilterButton
						pressed={filter === null}
						onClick={() => pick(null)}
					>
						everything
					</FilterButton>
					{TAGS.map((tag) => (
						<FilterButton
							key={tag}
							tag={tag}
							pressed={filter === tag}
							onClick={() => pick(tag)}
						>
							{tag}
						</FilterButton>
					))}
				</div>

				<div className={styles.cards}>
					{shown.map((project) => (
						<ProjectCard
							key={project.name}
							project={project}
							index={projects.indexOf(project)}
						/>
					))}
				</div>
			</div>
		</main>
	);
}

interface FilterButtonProps {
	/** Tints the glass and its HDR bloom; untinted when absent. */
	tag?: ProjectTag;
	pressed: boolean;
	onClick: () => void;
	children: ReactNode;
}

function FilterButton({ tag, pressed, onClick, children }: FilterButtonProps) {
	const style = tag
		? cssVars({
				"--c": TAG_COLORS[tag],
				"--bloom": `var(--bloom-${TAG_BLOOMS[tag]})`,
			})
		: undefined;

	return (
		<button
			type="button"
			className={`glass ${styles.filter}`}
			style={style}
			aria-pressed={pressed}
			onClick={onClick}
		>
			{children}
		</button>
	);
}
