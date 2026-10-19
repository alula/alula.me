import { createFileRoute } from "@tanstack/react-router";
import styles from "../webring.module.css";
import webring from "virtual:webring";

export const Route = createFileRoute("/webring")({
	component: Webring,
});

export default function Webring() {
	// webring is a static array imported from generated JSON
	return (
		<main className={styles.container}>
			<h1>Webring</h1>

			<div className={styles.webring}>
				<p>webring</p>
				{webring.map(({ name, url, imageFile }) => (
					<a href={url} key={name} target="_blank" rel="noreferrer">
						<img
							src={`/webring/${imageFile || `${name}.png`}`}
							alt={name}
							width={88}
							height={31}
						/>
					</a>
				))}
			</div>

			<a href="https://github.com/alula/alula.me/blob/master/WEBRING.md">
				Add yourself to the webring
			</a>
		</main>
	);
}
