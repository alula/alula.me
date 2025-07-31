import ExportedImage from "next-image-export-optimizer";
import { getWebring } from "../lib/webring";
import styles from "./page.module.css";

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

export default async function Home() {
	const webring = await getWebring();

	return (
		<main className={styles.container}>
			<h1>Webring</h1>

			<div className={styles.webring}>
				<p>webring</p>
				{webring.map(({ name, url, imageFile }) => (
					<a href={url} key={name} target="_blank" rel="noreferrer">
						<ExportedImage
							src={`/webring/${imageFile || `${name}.png`}`}
							alt={name}
							unoptimized={true}
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
