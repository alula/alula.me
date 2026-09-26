import { createFileRoute } from "@tanstack/react-router";
import styles from "../webring.module.css";
import { ButtonWall, LinkBack } from "../components/ButtonWall";
import { PageHeader } from "../components/PageHeader";

export const Route = createFileRoute("/webring")({
	component: Webring,
});

export default function Webring() {
	return (
		<main>
			<PageHeader kicker="// friends of the rabbit" title="webring">
				<p>
					Cool people with cool websites.
				</p>
			</PageHeader>

			<div className={styles.body}>
				<ButtonWall />

				<div className={styles.aside}>
					<div className={`cel ${styles.card}`}>
						<h2>join the ring</h2>
						<p>
							Got an 88x31 and a website? Open a PR with your
							button and a tiny <code>meta.json</code>.
						</p>
						<a
							className={styles.join}
							href="https://github.com/alula/alula.me/blob/master/WEBRING.md"
						>
							Add yourself to the webring
						</a>
					</div>
					<LinkBack />
				</div>
			</div>
		</main>
	);
}
