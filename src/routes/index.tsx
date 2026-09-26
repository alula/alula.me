import { createFileRoute, Link } from "@tanstack/react-router";
import styles from "../page.module.css";
import { projectsHostedOnAlulaMe } from "../../app/lib/projects";
import { Hero } from "../components/Hero";
import { Arrow } from "../components/icons";
import { SupportWarnings } from "../components/SupportWarnings";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<main>
			<Hero />

			<section className={`cel ${styles.intro}`} aria-label="More">
				<p>
					<Link to="/projects" className={styles.link}>
						Maybe you want to see a list of some of the stuff I've
						worked on? <Arrow />
					</Link>
				</p>

				<p>
					<Link to="/webring" className={styles.link}>
						Webring <Arrow />
					</Link>
				</p>

				<details className={styles.hosted}>
					<summary>
						Check out some of the fun things that are hosted here.
					</summary>
					<ul>
						{projectsHostedOnAlulaMe.map((project) => (
							<li key={project.name}>
								<a
									href={project.url}
									target="_blank"
									rel="noreferrer"
								>
									{project.name}
								</a>
							</li>
						))}
					</ul>
				</details>
			</section>

			<SupportWarnings />
		</main>
	);
}
