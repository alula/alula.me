import {
	BackSide,
	Color,
	DataTexture,
	ExtrudeGeometry,
	Group,
	Mesh,
	NearestFilter,
	Object3D,
	PointLight,
	Raycaster,
	RedFormat,
	Vector3,
} from "three";
import { MeshBasicNodeMaterial, MeshToonNodeMaterial } from "three/webgpu";
import {
	float,
	mrt,
	normalLocal,
	normalView,
	positionLocal,
	positionViewDirection,
	uniform,
	vec3,
} from "three/tsl";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { WORDMARK_GLYPHS } from "./wordmarkGlyphs";
import { debugLog } from "../lib/debug";

const TEXT = "alula";
const OUTLINE_WIDTH = 0.014;

// Past 1.0 is brighter than paper white: HDR on screens that can, and what the bloom
// pass picks up everywhere else.
const FACE_GLOW = 0.25;
const RIM_GLOW = 0.9;
// candela of the light the word casts onto her, and how much a beat adds
const GLOW_LIGHT = 0.3;
const GLOW_LIGHT_BEAT = 0.7;

type Glyph = keyof typeof WORDMARK_GLYPHS.glyphs;

interface Letter {
	pivot: Object3D;
	hitbox: Mesh;
	hopStart: number;
	baseY: number;
}

/**
 * "alula" as real extruded geometry, cel shaded to sit next to her MToon look:
 * white faces, blue sides, and an inked outline from an inflated back-face hull.
 * Faces glow a little past white and a fresnel rim lights the bevels.
 */
export class Wordmark {
	readonly group = new Group();
	/** The glowing letters light her up a little, and flash with the beat. */
	#glowLight = new PointLight("#dce9ff", GLOW_LIGHT, 0, 2);
	/** Width of the whole word in em, before scaling. */
	readonly width: number;
	#letters: Letter[] = [];
	#disposables: { dispose(): void }[] = [];
	#tilt = new Vector3();
	/** 0..1 beat envelope while she dances, flashes the glow and bumps the letters. */
	#pulse = uniform(0);

	constructor() {
		// three hard bands: shadow, mid, lit
		const ramp = new DataTexture(
			new Uint8Array([110, 190, 255]),
			3,
			1,
			RedFormat,
		);
		ramp.minFilter = NearestFilter;
		ramp.magFilter = NearestFilter;
		ramp.needsUpdate = true;

		// 0 facing the camera, 1 at grazing angles
		const fresnel = float(1)
			.sub(normalView.dot(positionViewDirection).saturate())
			.pow(3);

		const face = new MeshToonNodeMaterial({
			color: new Color("#ffffff"),
			gradientMap: ramp,
		});
		// NodeMaterial reads emissiveNode for every material type, the typings only
		// declare it on the standard one.
		Object.assign(face, {
			emissiveNode: vec3(1, 0.98, 0.94).mul(
				fresnel.mul(RIM_GLOW).add(FACE_GLOW).add(this.#pulse.mul(0.8)),
			),
		});

		const side = new MeshToonNodeMaterial({
			color: new Color("#86a9f0"),
			gradientMap: ramp,
		});
		Object.assign(side, {
			emissiveNode: vec3(0.55, 0.75, 1.1).mul(
				fresnel.mul(RIM_GLOW).add(this.#pulse.mul(0.5)),
			),
		});

		const outline = new MeshBasicNodeMaterial({
			color: new Color("#2b3f86"),
			side: BackSide,
		});
		// faces and sides feed the bloom pass, the outline stays crisp
		const glows = mrt({ glow: float(1) });
		face.mrtNode = glows;
		side.mrtNode = glows;

		outline.positionNode = positionLocal.add(
			normalLocal.mul(OUTLINE_WIDTH),
		);
		this.#disposables.push(ramp, face, side, outline);

		const loader = new SVGLoader();
		const { unitsPerEm, glyphs } = WORDMARK_GLYPHS;
		const center = new Vector3();
		let x = 0;

		for (const ch of TEXT as Iterable<Glyph>) {
			const glyph = glyphs[ch];
			const svg = loader.parse(
				`<svg xmlns="http://www.w3.org/2000/svg"><path d="${glyph.path}"/></svg>`,
			);
			const shapes = svg.paths.flatMap((path) => path.toShapes());
			const geometry = new ExtrudeGeometry(shapes, {
				depth: 150,
				bevelEnabled: true,
				bevelThickness: 30,
				bevelSize: 18,
				bevelSegments: 4,
				curveSegments: 10,
			});
			geometry.scale(1 / unitsPerEm, 1 / unitsPerEm, 1 / unitsPerEm);
			geometry.computeBoundingBox();
			geometry.boundingBox!.getCenter(center);
			geometry.translate(-center.x, -center.y, -center.z);
			geometry.computeVertexNormals();
			this.#disposables.push(geometry);

			// Extrude groups: 0 is the front and back caps, 1 the walls and bevels.
			const mesh = new Mesh(geometry, [face, side]);
			const hull = new Mesh(geometry, outline);
			const pivot = new Object3D();
			pivot.position.set(x + center.x, center.y, 0);
			pivot.add(hull, mesh);
			this.group.add(pivot);
			this.#letters.push({
				pivot,
				hitbox: mesh,
				hopStart: -10,
				baseY: center.y,
			});

			x += glyph.advance / unitsPerEm;
		}

		this.width = x;
		// Centre the word horizontally around the group origin.
		for (const { pivot } of this.#letters) pivot.position.x -= x / 2;

		// middle of the word, a little in front of the letter faces
		this.#glowLight.position.set(0, 0.35, 0.3);
		this.group.add(this.#glowLight);
	}

	/** Pops a letter up when the cursor ray touches it. */
	hover(raycaster: Raycaster, time: number) {
		const hits = raycaster.intersectObjects(
			this.#letters.map((l) => l.hitbox),
			false,
		);
		if (!hits.length) return;
		const letter = this.#letters.find((l) => l.hitbox === hits[0].object);
		if (letter && time - letter.hopStart > 0.7) letter.hopStart = time;
	}

	/**
	 * Deterministic for a given time and pointer, so frame 0 matches the prerendered
	 * poster exactly.
	 * @param pointer smoothed pointer in -1..1
	 */
	update(
		time: number,
		dt: number,
		pointer: { x: number; y: number },
		pulse = 0,
		// 0..1, fades the idle bobbing in from the static poster state
		live = 1,
	) {
		this.#pulse.value = pulse;
		this.#glowLight.intensity = GLOW_LIGHT + pulse * GLOW_LIGHT_BEAT;
		const ease = 1 - Math.exp(-dt * 5);
		this.#tilt.x += (pointer.y * 0.18 - this.#tilt.x) * ease;
		this.#tilt.y += (pointer.x * 0.3 - this.#tilt.y) * ease;
		this.group.rotation.set(this.#tilt.x, this.#tilt.y, 0);

		this.#letters.forEach(({ pivot, hopStart, baseY }, i) => {
			const hopAge = (time - hopStart) / 0.6;
			const hop = hopAge < 1 ? Math.sin(hopAge * Math.PI) : 0;

			const beat = 1 + pulse * 0.07;
			pivot.scale.set(
				beat * (1 + hop * 0.06),
				beat * (1 - hop * 0.08),
				beat,
			);
			pivot.position.z = Math.sin(time * 1.3 + i * 0.9) * 0.02 * live;
			pivot.rotation.z =
				Math.sin(time * 1.1 + i * 1.7) * 0.035 * live - hop * 0.12;
			pivot.position.y =
				baseY +
				Math.sin(time * 1.6 + i * 0.8) * 0.018 * live +
				hop * 0.16;
		});
	}

	/** Transforms that shape the word on screen, rounded for diffing (?stagedebug). */
	readonly debugSnapshot =
		debugLog &&
		(() => {
			const r = (n: number) => Math.round(n * 1e4) / 1e4;
			const v = (x: { toArray(): number[] }) => x.toArray().map(r);
			return {
				p: v(this.group.position),
				s: r(this.group.scale.x),
				rot: [r(this.group.rotation.x), r(this.group.rotation.y)],
				pulse: r(this.#pulse.value),
				letters: this.#letters.map(({ pivot }) => [
					...v(pivot.position),
					r(pivot.rotation.z),
					r(pivot.scale.y),
				]),
			};
		});

	dispose() {
		this.#disposables.forEach((d) => d.dispose());
	}
}
