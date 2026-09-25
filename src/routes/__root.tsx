import { createRootRoute, Outlet } from "@tanstack/react-router";
import "../globals.css";
import "@fontsource/cabin/400.css";
import "@fontsource/cabin/700.css";

const RootLayout = () => <Outlet />;

export const Route = createRootRoute({ component: RootLayout });
