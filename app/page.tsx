import Image from "next/image";
import styles from "./page.module.css";
import ExportedImage from "next-image-export-optimizer";
import alula from "./alula.png";
import { getWebring } from "./lib/webring";

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
	{
		name: "Discord",
		url: "https://discord.com/users/219067402174988290",
	},
];

export const dynamic = 'force-static';

export default async function Home() {
	const webring = await getWebring();

	return (
		<main className={styles.container}>
			<h1>hello world</h1>
			<p>{"I go by Alula online, I like messing with computers and I often program or reverse engineer things."}</p>
			<p>
				Dump of my relevant socials:{" "}
				{socials.map(({ name, url }, idx) => (
					<>
						{idx > 0 && ", "}
						<a href={url} target="_blank" rel="noreferrer">
							{name}
						</a>
					</>
				))}
			</p>
			<p>
				{
					"I'm too lazy to make a proper website (this was made within 20 minutes), here's my bunny fursona instead."
				}
			</p>
			<div style={{ position: "relative", height: "60vh" }}>
				<ExportedImage
					src={alula}
					alt="alula"
					fill={true}
					style={{ objectFit: "contain" }}
				/>
			</div>

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
		</main>
	);
}
