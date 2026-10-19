export interface Project {
	name: string;
	url: string;
	description: string;
}

export const projects: Project[] = [
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
		name: "Kero Blaster",
		url: "https://playism.com/en/game/keroblaster/",
		description:
			"I was responsible for creating the Android and macOS ports of the game.",
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
		name: "ryujinx-lle",
		url: "https://github.com/alula/Ryujinx",
		description:
			"A WIP and super experimental fork of the Switch emulator Ryujinx aiming to run parts of the OS. Capable of going through the setup process and booting into the Home Menu. Does not really run any games yet.",
	},
	{
		name: "checkbox.ing",
		url: "https://github.com/alula/bitmap",
		description:
			"A collaborative website where people can check boxes together, made shortly after viral 1 Million Checkboxes has been shut down. It's been made with the goal to build a clone that can potentially scale better and handle more checkboxes with less resources. Uses lock-free atomics and a packet overhead efficient, zero-copy protocol.",
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
		name: "Craftcord (Discord Activity)",
		url: "https://blog.pnly.io/craftcord/",
		description:
			"Unreleased Discord Activity that allows merging things in a collaborative space and letting AI create combinations. I've been one of main developers of it.",
	},
	{
		name: "Mainline Linux kernel port for MSM89x7/MSM8940",
		url: "https://github.com/dreemurrs-embedded/linux-msm89x7",
		description:
			"Made some good progress, abandoned after I fried the Redmi 4X I used for this by accident because I didn't seat one of flex tapes properly after some repair work :(",
	},
	{
		name: "Windows 10/11 for TP1803",
		url: "https://github.com/alula/TP1803-Windows-Guide",
		description:
			"Windows for a prototype SM8150-based phone that a lot of cool folks from Android custom ROM development community have owned.",
	},
	{
		name: "HX83112 digitizer driver for Windows",
		url: "https://github.com/alula/HX83112-Windows-Driver",
		description:
			"A WIP driver for the touch panel used in TP1803, based on Gus' Synaptic digitizer Windows driver and the official Android driver.",
	},
];

export const projectsHostedOnAlulaMe: Project[] = projects.filter((project) =>
	project.url.includes("alula.me"),
);
