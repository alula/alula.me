import styles from "./page.module.css";
import { projectsHostedOnAlulaMe } from "./lib/projects";

const socials = [
	{
		name: "GitHub",
		url: "https://github.com/alula",
	},
	{
		name: "Twitter",
		url: "https://twitter.com/__alula",
	},
	{
		name: "Telegram",
		url: "https://t.me/aluuula",
	},
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
					<>
						{idx > 0 && ", "}
						<a href={url} target="_blank" rel="noreferrer">
							{name}
						</a>
					</>
				))}
			</p>

			{/* <a href="/projects">
				Maybe you want to see a list of some of the stuff I've worked on?
			</a> */}

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
