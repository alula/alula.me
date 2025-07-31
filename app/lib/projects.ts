export interface Project {
	name: string;
	url: string;
	description: string;
}

export const projects: Project[] = [
	{
		name: "Kero Blaster",
		url: "https://playism.com/en/game/keroblaster/",
		description:
			"I was responsible for creating the Android and macOS ports of the game.",
	},
	{
		name: "doukutsu-rs",
		url: "https://doukutsu.rs",
		description:
			"A faithful and open-source remake of Cave Story's engine written in Rust.",
	},
	{
		name: "Discords.com",
		url: "https://discords.com",
		description: "A Discord server list I got heavily involved in.",
	},
	{
		name: "Discord Guild Tag Finder",
		url: "https://guildtags.alula.me",
		description:
			"A simple website that allows to find Discord guild tags that appear longer (by abusing ligatures) and fit within 4 characters.",
	},
	{
		name: "Zuma Deluxe Level Editor",
		url: "https://zumaeditor.alula.me",
		description: "A level editor for Zuma Deluxe.",
	},
	{
		name: "Space Cadet Pinball (WASM port)",
		url: "https://pinball.alula.me",
		description: "A port of famous 3D Pinball - Space Cadet to the web.",
	},
	{
		name: "PxTone for Godot",
		url: "https://github.com/Xysspon/XyssPxTone-Godot",
		description:
			"A Godot Engine module that adds native playback support for PxTone (.ptcop, .pttune) music files.",
	},
	{
		name: "Xysspon",
		url: "https://xysspon.com/",
		description:
			"I built the website for game studio Xysspon. I was also involved in assisting with the development of their games.",
	},
	{
		name: "cf-workers-media-proxy",
		url: "https://github.com/alula/cf-workers-media-proxy",
		description:
			"A simple image media proxy written in Rust for Cloudflare Workers. Supports passthrough of SVG, PNG, JPEG, and WebP images, with options for resizing, quality, and format conversion. Easily integrates with Next.js via a custom image loader.",
	},
	{
		name: "Kyoko",
		url: "https://kyokobot.moe",
		description: "My old Discord bot.",
	},
	{
		name: "CircleShootApp",
		url: "https://github.com/alula/CircleShootApp",
		description: "Zuma Deluxe decompilation",
	},
	{
		name: "IPv6 Place",
		url: "https://github.com/alula/ipv6-place",
		description:
			"Now inactive due to insane network traffic requirements. 512x512 canvas, ping IPv6 address to put a pixel at a specific location.",
	},
	{
		name: "organya.js",
		url: "https://github.com/alula/organya-js",
		description:
			"A really tiny, pure JavaScript, Web Audio API-based player of Organya music files, most famously used in Studio Pixel's Cave Story.",
	},
	{
		name: "ryujinx-lle",
		url: "https://github.com/alula/Ryujinx",
		description:
			"A WIP and super experimental fork of the Switch emulator Ryujinx aiming to run parts of the OS. Capable of going through the setup process and booting into the Home Menu. Does not really run any games yet.",
	},
];

export const projectsHostedOnAlulaMe: Project[] = projects.filter((project) =>
	project.url.includes("alula.me"),
);
