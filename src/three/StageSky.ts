// The hero sky, an equirect panorama seen through the stage camera and composited
// behind her in the stage's own output pass. Same canvas as her, so it can't drift
// from the scene, and HDR screens treat both as one layer.
import {
	LinearFilter,
	Matrix3,
	type PerspectiveCamera,
	RepeatWrapping,
	SRGBColorSpace,
	Texture,
	TextureLoader,
	Vector2,
	Vector4,
} from "three";
import {
	acos,
	atan,
	dot,
	float,
	length,
	max,
	mix,
	PI,
	screenCoordinate,
	screenSize,
	screenUV,
	smoothstep,
	texture,
	TWO_PI,
	uniform,
	vec2,
	vec3,
	vec4,
} from "three/tsl";
import type { TextureNode } from "three/webgpu";
import type { SkyPreset } from "../lib/skies";
import { FORWARD_U, LENS_WIDEN } from "../lib/skyLens";

// how far past paper white the brightest clouds go on HDR screens
const PEAK = 3.6;

export class StageSky {
	#loader = new TextureLoader();
	#texture: Texture | null = null;
	#image = "";
	#rotation = uniform(new Matrix3());
	// camera-space view ray = (ndc.x * x + y, ndc.y * z + w, -1)
	#lens = uniform(new Vector4());
	#forwardU = uniform(0);
	// luminance range where HDR expansion ramps up, see SkyPreset.highlights
	#highlights = uniform(new Vector2());
	#hdr = uniform(0);
	// where the sky frame starts below the canvas top, and its corner radius, in
	// device pixels: the canvas pokes out above the frame for her ears
	#frameTop = uniform(0);
	#radius = uniform(0);
	#map: TextureNode;

	/** Linear sky colour, premultiplied by its coverage of the frame. */
	readonly node;

	constructor() {
		const ndc = screenUV.mul(2).sub(1).mul(vec2(1, -1));
		const lens = this.#lens;
		const ray = this.#rotation
			.mul(
				vec3(
					ndc.x.mul(lens.x).add(lens.y),
					ndc.y.mul(lens.z).add(lens.w),
					-1,
				),
			)
			.normalize();
		// three flips images on upload, so v runs up from the bottom row
		const uv = vec2(
			this.#forwardU.add(atan(ray.x, ray.z.negate()).div(TWO_PI)),
			acos(ray.y.clamp(-1, 1)).div(PI).oneMinus(),
		);
		this.#map = texture(new Texture(), uv);
		const c = this.#map.rgb;
		const y = dot(c, vec3(0.2126, 0.7152, 0.0722));
		// ease saturation off a little, and more in the highlights
		const eased = mix(c, vec3(y), smoothstep(0.6, 1, y).mul(0.25).add(0.1));
		// These skies are made for game engines, i.e. already tone mapped, and their
		// plain sky is almost as bright as their clouds. So on HDR screens only what's
		// above the sky's own highlight knee is expanded: the sky itself stays at SDR
		// levels and the clouds and sun glow ramp up to PEAK x paper white.
		const k = smoothstep(this.#highlights.x, this.#highlights.y, y);
		const color = eased.mul(
			k
				.mul(k)
				.mul(PEAK - 1)
				.mul(this.#hdr)
				.add(1),
		);

		// the frame: everything below frameTop, with rounded top corners (the page
		// rounds the bottom ones)
		const p = screenCoordinate;
		const r = this.#radius;
		const dx = max(max(r.sub(p.x), p.x.sub(screenSize.x.sub(r))), 0);
		const dy = max(this.#frameTop.add(r).sub(p.y), 0);
		const outside = length(vec2(dx, dy)).sub(r);
		const coverage = float(0.5).sub(outside).clamp(0, 1);
		this.node = vec4(color.mul(coverage), coverage);
	}

	/** Loads a sky's panorama, resolving once it's what gets drawn. */
	async set(sky: SkyPreset, hdr: boolean) {
		this.#hdr.value = hdr ? 1 : 0;
		if (sky.image === this.#image) return;
		this.#image = sky.image;
		const next = await this.#loader.loadAsync(sky.image);
		// a newer set() won the race
		if (this.#image !== sky.image) {
			next.dispose();
			return;
		}
		next.colorSpace = SRGBColorSpace;
		next.wrapS = RepeatWrapping;
		// no mipmaps, so the jump in u where the panorama wraps leaves no seam
		next.generateMipmaps = false;
		next.minFilter = LinearFilter;
		this.#texture?.dispose();
		this.#texture = next;
		this.#map.value = next;
		this.#highlights.value.set(...sky.highlights);
	}

	/**
	 * @param radius the frame's corner radius in CSS pixels
	 * @param overscan how much taller the canvas is than the sky frame
	 */
	resize(
		heightPx: number,
		pixelRatio: number,
		overscan: number,
		radius: number,
	) {
		this.#frameTop.value = heightPx * (1 - 1 / overscan);
		this.#radius.value = radius * pixelRatio;
	}

	/** Follows the camera, call after it moved and before rendering. */
	update(camera: PerspectiveCamera, offset: number) {
		camera.updateMatrixWorld();
		this.#rotation.value.setFromMatrix4(camera.matrixWorld);
		const p = camera.projectionMatrix.elements;
		this.#lens.value.set(
			LENS_WIDEN / p[0],
			(LENS_WIDEN * p[8]) / p[0],
			LENS_WIDEN / p[5],
			(LENS_WIDEN * p[9]) / p[5],
		);
		this.#forwardU.value = FORWARD_U + offset;
	}

	dispose() {
		this.#texture?.dispose();
		this.#image = "";
	}
}
