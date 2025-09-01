import styles from "./page.module.css";
import { projectsHostedOnAlulaMe } from "./lib/projects";
import { Fragment } from "react";

const socials = [
	{ name: "GitHub", url: "https://github.com/alula" },
	{ name: "X (formerly Twitter)", url: "https://x.com/__alula" },
	{ name: "Telegram", url: "https://t.me/aluuula" },
	{ name: "Bluesky", url: "https://bsky.app/profile/alula.me" },
	{ name: "Discord Server", url: "https://discord.gg/5g9qdABNQ8" },
];

export const dynamic = "force-static";

export default function Home() {
	return (
		<main className={styles.container}>
			<h1>hello world</h1>
			<p>
				I go by <b>Alula</b> online, I like messing with computers and I
				often program or reverse engineer things.
			</p>
			<p>
				{socials.map(({ name, url }, idx) => (
					<Fragment key={name}>
						{idx > 0 && ", "}
						<a href={url} target="_blank" rel="noreferrer">
							{name}
						</a>
					</Fragment>
				))}
			</p>

			<p>
				<a href="/projects">
					Maybe you want to see a list of some of the stuff I've
					worked on?
				</a>
			</p>

			<p>
				<a href="/webring">Webring</a>
			</p>

			<details>
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
		</main>
	);
}
