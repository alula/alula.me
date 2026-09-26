// Best-effort HDR output for the WebGL 2 fallback. WebGPU gets it from the
// renderer's half float canvas with extended tone mapping instead.
import type { Node, WebGPURenderer } from "three/webgpu";
import { Fn, log, mat3, max, mix, sqrt, step, vec3, vec4 } from "three/tsl";
import { debugLog } from "../lib/debug";

/** WebGL 2 plus Chrome's HDR canvas additions, which aren't in lib.dom yet. */
type HdrWebGL2 = Omit<WebGL2RenderingContext, "drawingBufferColorSpace"> & {
	// lib.dom only knows srgb and display-p3
	drawingBufferColorSpace: string;
	drawingBufferStorage?(format: number, width: number, height: number): void;
	// what drawingBufferStorage last allocated, where the browser reports it
	drawingBufferFormat?: number;
	drawingBufferToneMapping?(options: { mode: "standard" | "extended" }): void;
};

export interface WebGLHdr {
	/**
	 * "hlg": the canvas expects a BT.2100 HLG signal, compose with composeHLG.
	 * "extended": linear values past 1.0 just work.
	 */
	mode: "hlg" | "extended";
	/**
	 * Puts the HDR buffer back if something reset it: resizes do, and Chrome on macOS
	 * has been seen dropping to SDR on its own until the next resize. Cheap when
	 * nothing changed, so call it before every frame.
	 */
	ensure(): void;
}

/** Browsers without HDR canvases either throw on the unknown value or ignore it. */
function trySetColorSpace(gl: HdrWebGL2, space: string) {
	try {
		gl.drawingBufferColorSpace = space;
	} catch {
		return false;
	}
	return gl.drawingBufferColorSpace === space;
}

// Sized from the canvas: after a resize the drawing buffer can still have the old
// size until this reallocates it.
function floatStorage(gl: HdrWebGL2, force = false) {
	const { width, height } = gl.canvas;
	if (
		!force &&
		gl.drawingBufferWidth === width &&
		gl.drawingBufferHeight === height &&
		(gl.drawingBufferFormat ?? gl.RGBA16F) === gl.RGBA16F
	)
		return;
	gl.drawingBufferStorage?.(gl.RGBA16F, width, height);
}

/**
 * Only on HDR displays, tries in order:
 * 1. a rec2100-hlg drawing buffer, which current Chrome does without flags (see
 *    ccameron-chromium.github.io/webgl-examples/canvas-hdr.html). HLG rather
 *    than PQ because it's relative: reference white lands on the display's own
 *    SDR white, where PQ's absolute nits came out brighter and more saturated
 *    than the page around it. Keeps the default 8-bit buffer: asking for a float
 *    one on top of it renders nothing.
 * 2. a float buffer with extended tone mapping (Chrome, behind "Experimental Web
 *    Platform features", see ccameron-chromium/webgl-hdr)
 * Returns null otherwise, or when three isn't on the WebGL backend.
 */
export function setupWebGLHdr(renderer: WebGPURenderer): WebGLHdr | null {
	const backend = renderer.backend as {
		isWebGLBackend?: boolean;
		gl?: HdrWebGL2;
	};
	const gl = backend.isWebGLBackend ? backend.gl : undefined;
	if (!gl) return null;
	if (!window.matchMedia("(dynamic-range: high)").matches) {
		debugLog?.("hdr", "SDR display, not asking for HDR");
		return null;
	}

	if (trySetColorSpace(gl, "rec2100-hlg")) {
		watchBuffer?.(gl, "hlg");
		return {
			mode: "hlg",
			ensure: () => {
				watchBuffer?.(gl, "changed");
				if (gl.drawingBufferColorSpace === "rec2100-hlg") return;
				trySetColorSpace(gl, "rec2100-hlg");
				watchBuffer?.(gl, "reapplied");
			},
		};
	}
	debugLog?.(
		"hdr",
		"no rec2100-hlg drawing buffer",
		gl.drawingBufferColorSpace,
	);

	if (!gl.drawingBufferStorage || !gl.drawingBufferToneMapping) {
		debugLog?.(
			"hdr",
			"no drawingBufferStorage / drawingBufferToneMapping, staying SDR",
		);
		return null;
	}
	try {
		gl.getExtension("EXT_color_buffer_half_float");
		gl.getExtension("EXT_color_buffer_float");
		floatStorage(gl, true);
		gl.drawingBufferToneMapping({ mode: "extended" });
		watchBuffer?.(gl, "extended");
		return {
			mode: "extended",
			ensure: () => {
				watchBuffer?.(gl, "changed");
				floatStorage(gl);
				watchBuffer?.(gl, "reapplied");
			},
		};
	} catch (e) {
		console.warn("WebGL HDR not available, staying SDR", e);
		return null;
	}
}

// For the debug log: logs the drawing buffer whenever it differs from last time.
let lastBuffer = "";
const watchBuffer =
	debugLog &&
	((gl: HdrWebGL2, event: string) => {
		const state = {
			colorSpace: gl.drawingBufferColorSpace,
			format:
				gl.drawingBufferFormat === gl.RGBA16F
					? "RGBA16F"
					: gl.drawingBufferFormat,
			buffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
			canvas: `${gl.canvas.width}x${gl.canvas.height}`,
		};
		const key = JSON.stringify(state);
		if (key === lastBuffer) return;
		lastBuffer = key;
		debugLog?.("hdr", event, state);
	});

// Scene-linear value that the HLG OETF maps to 0.75, reference (SDR) white per
// BT.2408. Scaling by it puts 1.0 in the scene on white and leaves ~3.8x of
// headroom above it for the glow.
const HLG_REFERENCE_WHITE = 0.2649;

// Linear BT.709 to linear BT.2020. TSL's mat3() takes rows, like Matrix3.set().
// prettier-ignore
const REC709_TO_REC2020 = mat3(
	0.6274, 0.3293, 0.0433,
	0.0691, 0.9195, 0.0114,
	0.0164, 0.088, 0.8956,
);

/** Linear BT.709 colour to a BT.2100 HLG signal. */
const encodeHLG = Fn(([linear]: [Node<"vec3">]) => {
	const a = 0.17883277;
	const b = 0.28466892;
	const c = 0.55991073;

	const e = REC709_TO_REC2020.mul(linear)
		.mul(HLG_REFERENCE_WHITE)
		.clamp(0, 1);
	const low = sqrt(e.mul(3));
	// clamped so the branch that isn't picked can't turn into NaN
	const high = log(e.mul(12).sub(b).max(1e-6)).mul(a).add(c);
	return mix(high, low, step(e, vec3(1 / 12)));
});

/**
 * Premultiplied HLG output. The glow gets real coverage (its brightness) instead
 * of being light with zero alpha: that's tolerated as additive in sRGB, but in an
 * HDR encoding even a faint halo encodes to a visible value and smears dark.
 * @param scene linear scene colour, premultiplied: the scene pass renders with
 *   normal blending into a transparent target, so it already stores rgb * alpha.
 *   Multiplying by alpha again would darken every antialiased edge.
 * @param glow linear bloom light, added on top
 */
export const composeHLG = Fn(
	([scene, alpha, glow]: [Node<"vec3">, Node<"float">, Node<"vec3">]) => {
		const glowCoverage = max(glow.r, max(glow.g, glow.b)).min(1);
		const coverage = alpha.add(glowCoverage.mul(alpha.oneMinus()));
		const premultiplied = scene.add(glow);
		const straight = premultiplied.div(coverage.max(1e-4));
		return vec4(encodeHLG(straight).mul(coverage), coverage);
	},
);
