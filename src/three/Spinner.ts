import { CircleGeometry, Color, Group, MathUtils, Mesh, Object3D } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";

const DOTS = 8;
const RADIUS = 0.075;
const DOT_SIZE = 0.02;
const SPEED = 1.4; // turns per second
// from the head bone at the base of her skull; her hair tuft reaches past 0.35
const HEIGHT_ABOVE_HEAD = 0.55;

/**
 * A good old ring-of-dots loading throbber that floats above her head while the
 * dance loads. Deliberately silly: she's literally buffering.
 */
export class Spinner {
	readonly group = new Group();
	#dots: {
		mesh: Mesh;
		material: MeshBasicNodeMaterial;
		outline: MeshBasicNodeMaterial;
	}[] = [];
	#geometry = new CircleGeometry(DOT_SIZE, 16);
	// a dark rim so the dots read on her orange hair, white clouds and dusk alike
	#outlineGeometry = new CircleGeometry(DOT_SIZE * 1.45, 16);
	#show = 0;

	constructor() {
		const colors = ["#ffffff", "#ffc94a"];
		for (let i = 0; i < DOTS; i++) {
			const material = new MeshBasicNodeMaterial({
				color: new Color(colors[i % 2]),
				transparent: true,
				depthTest: false,
			});
			const mesh = new Mesh(this.#geometry, material);
			const angle = (i / DOTS) * Math.PI * 2;
			mesh.position.set(
				Math.sin(angle) * RADIUS,
				Math.cos(angle) * RADIUS,
				0,
			);
			mesh.renderOrder = 10;
			const outline = new MeshBasicNodeMaterial({
				color: new Color("#3b2420"),
				transparent: true,
				depthTest: false,
			});
			const rim = new Mesh(this.#outlineGeometry, outline);
			rim.renderOrder = 9;
			mesh.add(rim);
			this.group.add(mesh);
			this.#dots.push({ mesh, material, outline });
		}
		this.group.visible = false;
	}

	/**
	 * @param head her head bone, the spinner hovers above it
	 * @param camera so it always faces the viewer
	 */
	update(
		time: number,
		dt: number,
		active: boolean,
		head: Object3D,
		camera: Object3D,
	) {
		this.#show +=
			((active ? 1 : 0) - this.#show) * (1 - Math.exp(-dt * 10));
		this.group.visible = this.#show > 0.01;
		if (!this.group.visible) return;

		head.getWorldPosition(this.group.position);
		this.group.position.y += HEIGHT_ABOVE_HEAD;
		this.group.quaternion.copy(camera.quaternion);
		// pops in with a little overshoot, shrinks away when done
		this.group.scale.setScalar(
			this.#show * (1 + Math.sin(this.#show * Math.PI) * 0.25),
		);

		// the lit dot runs around the ring, the rest trail off behind it
		const lead = (time * SPEED * DOTS) % DOTS;
		this.#dots.forEach(({ mesh, material, outline }, i) => {
			const behind = MathUtils.euclideanModulo(lead - i, DOTS) / DOTS;
			const glow = 1 - behind;
			material.opacity = 0.25 + 0.75 * glow;
			outline.opacity = material.opacity * 0.85;
			mesh.scale.setScalar(0.6 + 0.6 * glow * glow);
		});
	}

	dispose() {
		this.#geometry.dispose();
		this.#outlineGeometry.dispose();
		this.#dots.forEach(({ material, outline }) => {
			material.dispose();
			outline.dispose();
		});
	}
}
