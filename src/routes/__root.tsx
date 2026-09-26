import { createRootRoute, Outlet } from "@tanstack/react-router";
import "@fontsource/mali/400.css";
import "@fontsource/mali/500.css";
import "@fontsource/mali/600.css";
import "@fontsource/mali/700.css";
import "@fontsource-variable/fredoka/wdth.css";
import "@fontsource-variable/suse-mono";
import "../globals.css";
import { FurSpots } from "../components/FurSpots";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { useGlassPointer } from "../lib/glass";

function RootLayout() {
	useGlassPointer();

	return (
		<div className="page">
			<FurSpots />
			<span className="hdr-enabler" aria-hidden="true" />
			<SiteNav />
			<Outlet />
			<SiteFooter />
		</div>
	);
}

export const Route = createRootRoute({ component: RootLayout });
