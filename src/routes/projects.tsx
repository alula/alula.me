import { createFileRoute } from "@tanstack/react-router";
import styles from "../projects.module.css";
import { Project, projects } from "../../app/lib/projects";

export const Route = createFileRoute("/projects")({
	component: Projects,
});

function ProjectCard({ project }: { project: Project }) {
	const { name, url, description } = project;

	return (
		<div className={styles.projectCard}>
			<div className={styles.projectCardHeader}>
				<a href={url} target="_blank" rel="noreferrer">
					{name}
				</a>
			</div>
			<div className={styles.projectCardDescription}>
				<p>{description}</p>
			</div>
		</div>
	);
}

function Projects() {
	return (
		<main className={styles.container}>
			<h1>{"Stuff I've worked on"}</h1>
			<p>
				{"I've worked on a lot of stuff, but here's a small selection of what I " +
					"can link or I'm comfortable sharing (presented in no particular order)."}
			</p>

			<div className={styles.projectCards}>
				{projects.map((project) => (
					<ProjectCard key={project.name} project={project} />
				))}
			</div>
		</main>
	);
}
