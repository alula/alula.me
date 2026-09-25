import { Plugin } from "vite";
import fs from "fs/promises";
import path from "path";

const VIRTUAL_MODULE_ID = "virtual:webring";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

async function loadWebring() {
	const webringSrcPath = path.join(process.cwd(), "app/webring");
	const entries = await fs.readdir(webringSrcPath, { withFileTypes: true });

	const webring = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory())
			.map(async (entry) => {
				const metaPath = path.join(
					webringSrcPath,
					entry.name,
					"meta.json",
				);
				const metaContent = await fs.readFile(metaPath, "utf-8");
				return JSON.parse(metaContent);
			}),
	);

	const PINNED = ["alula"];
	return [
		...webring.filter((entry) => PINNED.includes(entry.name)),
		...webring
			.filter((entry) => !PINNED.includes(entry.name))
			.sort((a, b) => a.name.localeCompare(b.name)),
	];
}

export function webringSrcPlugin(): Plugin {
	let webringData: any[] = [];

	return {
		name: "webring-src",
		async configResolved() {
			webringData = await loadWebring();
		},
		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID;
			}
		},
		async load(id) {
			if (id === RESOLVED_VIRTUAL_MODULE_ID) {
				return `export default ${JSON.stringify(webringData)}`;
			}
		},
	};
}
