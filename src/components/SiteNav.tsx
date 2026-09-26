import { Link } from "@tanstack/react-router";
import styles from "./SiteNav.module.css";

const LINKS = [
	{ to: "/", label: "home" },
	{ to: "/projects", label: "projects" },
	{ to: "/webring", label: "webring" },
] as const;

export function SiteNav() {
	return (
		<header className={styles.header}>
			<nav className={`glass ${styles.nav}`} aria-label="Main">
				<Link to="/" className={styles.brand}>
					<span>
						alula<span className={styles.tld}>.me</span>
					</span>
				</Link>
				<ul className={styles.links}>
					{LINKS.map(({ to, label }) => (
						<li key={to}>
							<Link
								to={to}
								className={styles.link}
								activeOptions={{ exact: true }}
								activeProps={{
									"aria-current": "page",
									className: "glass",
								}}
							>
								{label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</header>
	);
}
