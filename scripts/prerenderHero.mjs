// Captures the 3D hero's first frame as the posters shown until the canvas is live:
//   pnpm dev   (in another terminal)
//   node scripts/prerenderHero.mjs [https://localhost:5173]
// Needs google-chrome and ImageMagick. Writes src/assets/hero-{wide,narrow}{,-dark}.webp.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] ?? "https://localhost:5173";

// Viewports that give the hero its typical wide and narrow shapes, each in both
// colour schemes since she's lit to match the day or dusk sky.
const VARIANTS = [
	{ name: "wide", width: 1440, height: 900, dark: false },
	{ name: "narrow", width: 390, height: 844, dark: false },
	{ name: "wide-dark", width: 1440, height: 900, dark: true },
	{ name: "narrow-dark", width: 390, height: 844, dark: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), "prerender-"));
const port = 9222 + Math.floor(Math.random() * 500);
const chrome = spawn(
	"google-chrome",
	[
		"--headless=new",
		// the dev server's certificate is self-signed (@vitejs/plugin-basic-ssl)
		"--ignore-certificate-errors",
		"--hide-scrollbars",
		"--enable-unsafe-swiftshader",
		`--remote-debugging-port=${port}`,
		`--user-data-dir=${tmp}`,
		"about:blank",
	],
	{ stdio: "ignore" },
);

try {
	let target;
	for (let i = 0; i < 50 && !target; i++) {
		await sleep(200);
		try {
			const list = await (
				await fetch(`http://127.0.0.1:${port}/json`)
			).json();
			target = list.find((t) => t.type === "page");
		} catch {
			// not up yet
		}
	}
	if (!target) throw new Error("Chrome didn't start");

	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((r) => ws.addEventListener("open", r));
	let id = 0;
	const pending = new Map();
	ws.addEventListener("message", (e) => {
		const msg = JSON.parse(e.data);
		pending.get(msg.id)?.(msg);
		pending.delete(msg.id);
	});
	const send = (method, params = {}) =>
		new Promise((resolve) => {
			pending.set(++id, resolve);
			ws.send(JSON.stringify({ id, method, params }));
		});
	const evaluate = async (expression) =>
		(
			await send("Runtime.evaluate", {
				expression,
				awaitPromise: true,
				returnByValue: true,
			})
		).result?.result?.value;

	await send("Page.enable");
	await send("Runtime.enable");
	await send("Emulation.setDefaultBackgroundColorOverride", {
		color: { r: 0, g: 0, b: 0, a: 0 },
	});

	for (const { name, width, height, dark } of VARIANTS) {
		await send("Emulation.setEmulatedMedia", {
			features: [
				{
					name: "prefers-color-scheme",
					value: dark ? "dark" : "light",
				},
			],
		});
		await send("Emulation.setDeviceMetricsOverride", {
			width,
			height,
			deviceScaleFactor: 2,
			mobile: width < 600,
		});
		await send("Page.navigate", { url: `${base}/?prerender` });

		let ready = false;
		for (let i = 0; i < 150 && !ready; i++) {
			await sleep(200);
			ready = await evaluate(
				"document.documentElement.hasAttribute('data-prerender')",
			);
		}
		if (!ready)
			throw new Error(`${name}: the 3D scene never finished loading`);
		// wait until the canvas is fully shown, a half faded capture bakes into the poster
		for (let i = 0; i < 50; i++) {
			const opacity = await evaluate(
				"getComputedStyle(document.querySelector('canvas[data-stage]')).opacity",
			);
			if (opacity === "1") break;
			await sleep(100);
		}
		await sleep(200);

		const rect = await evaluate(
			"(() => { const r = document.querySelector('canvas[data-stage]').getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()",
		);
		const { result } = await send("Page.captureScreenshot", {
			format: "png",
			captureBeyondViewport: true,
			clip: { ...rect, scale: 1 },
		});
		const png = join(tmp, `${name}.png`);
		writeFileSync(png, Buffer.from(result.data, "base64"));
		const out = `src/assets/hero-${name}.webp`;
		execFileSync("magick", [
			png,
			"-quality",
			"86",
			"-define",
			"webp:alpha-quality=90",
			out,
		]);
		console.log(
			`${out}: ${Math.round(rect.width)}x${Math.round(rect.height)} css px`,
		);
	}

	ws.close();
} finally {
	chrome.kill();
	await sleep(300);
	rmSync(tmp, { recursive: true, force: true });
}
