import { CSSProperties } from "react";

/** Inline CSS custom properties, which React's CSSProperties doesn't know about. */
export function cssVars(
	vars: Record<`--${string}`, string | number>,
	style?: CSSProperties,
): CSSProperties {
	return { ...vars, ...style } as CSSProperties;
}
