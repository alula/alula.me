// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { webringSrcPlugin } from "./src/vite-plugins/webring";

// https://vitejs.dev/config/
export default defineConfig({
	esbuild: { legalComments: "eof" },
	server: {
		allowedHosts: [".local"],
	},
	plugins: [
		basicSsl(),
		webringSrcPlugin(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
	],
});
