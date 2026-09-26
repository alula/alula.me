import { promises as fs } from "node:fs";
import path from "node:path";

async function readAllMetaJson() {
	const webringDir = path.join(process.cwd(), "app", "webring");
	const entries = await fs.readdir(webringDir, { withFileTypes: true });
	const metaJsons = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			const metaPath = path.join(webringDir, entry.name, "meta.json");
			try {
				const data = await fs.readFile(metaPath, "utf-8");
				const meta = JSON.parse(data);
				meta._dirName = entry.name; // keep for default imageFile
				metaJsons.push(meta);
			} catch (err) {
				// Ignore if meta.json does not exist
			}
		}
	}

	return metaJsons;
}

async function fetchAndSaveImage(url, destPath) {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${res.status} ${res.statusText}`,
		);
	}
	const arrayBuffer = await res.arrayBuffer();

	// create the directory if it doesn't exist
	await fs.mkdir(path.dirname(destPath), { recursive: true });

	await fs.writeFile(destPath, Buffer.from(arrayBuffer));
}

async function main() {
	try {
		const metaJsons = await readAllMetaJson();
		const publicWebringDir = path.join(process.cwd(), "public", "webring");
		await fs.mkdir(publicWebringDir, { recursive: true });

		for (const meta of metaJsons) {
			if (meta.imageUrl) {
				let outFile;
				if (meta.imageFile) {
					outFile = meta.imageFile;
				} else {
					outFile = `${meta._dirName}.png`;
				}
				const outPath = path.join(publicWebringDir, outFile);
				try {
					console.log(`Fetching ${meta.imageUrl} -> ${outFile}`);
					await fetchAndSaveImage(meta.imageUrl, outPath);
					console.log(`Saved to ${outPath}`);
				} catch (err) {
					console.error(
						`Failed to fetch/save image for ${meta.name}:`,
						err.message,
					);
				}
			}
		}
	} catch (err) {
		console.error(err);
	}
}

main();
