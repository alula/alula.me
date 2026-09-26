import { CSSProperties, ElementType, ReactNode, useRef } from "react";
import { cssVars } from "../lib/css";
import { useInView } from "../lib/motion";

interface RevealProps {
	as?: ElementType;
	/** Stagger slot, each step delays the entrance a little more. */
	index?: number;
	tilt?: number;
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
}

export function Reveal({
	as: Tag = "div",
	index = 0,
	tilt,
	className,
	style,
	children,
}: RevealProps) {
	const ref = useRef<HTMLElement>(null);
	const inView = useInView(ref);
	const vars = cssVars({
		"--i": index,
		...(tilt !== undefined && { "--reveal-tilt": `${tilt}deg` }),
	});

	return (
		<Tag
			ref={ref}
			className={className}
			data-reveal=""
			data-in={inView ? "" : undefined}
			style={{ ...vars, ...style }}
		>
			{children}
		</Tag>
	);
}
