// `?stagedebug` logging for the 3D stage, in dev builds only. In production this is
// undefined, so every `debugLog?.(...)` call, arguments and all, is compiled out.
export const debugLog:
	| ((scope: string, event: string, detail?: unknown) => void)
	| undefined =
	import.meta.env.DEV &&
	new URLSearchParams(window.location.search).has("stagedebug")
		? (scope, event, detail) =>
				console.log(
					`[${scope}] ${event}`,
					// strings as is, the rest as JSON so it can be copied out of the console
					typeof detail === "string"
						? detail
						: (JSON.stringify(detail) ?? ""),
				)
		: undefined;
