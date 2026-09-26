import {
	AnimationAction,
	AnimationMixer,
	DirectionalLight,
	HemisphereLight,
	HalfFloatType,
	MathUtils,
	Object3D,
	PerspectiveCamera,
	Raycaster,
	Vector2,
	Scene,
	Timer,
	Vector3,
} from "three";
import { RenderPipeline, WebGPURenderer } from "three/webgpu";
import {
	dot,
	float,
	fract,
	mix,
	mrt,
	output,
	pass,
	renderOutput,
	screenCoordinate,
	sin,
	vec2,
	vec4,
} from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
	VRM,
	MToonMaterialLoaderPlugin,
	VRMHumanBoneName,
	VRMLoaderPlugin,
	VRMPose,
	VRMUtils,
} from "@pixiv/three-vrm";
import { MToonNodeMaterial } from "@pixiv/three-vrm/nodes";
import type { DanceCamera } from "./dance";
import type { VRMIKHandler } from "./vmd2vrm";
import type { Ground } from "./Ground";
import { Leek } from "./Leek";
import { Music } from "./Music";
import { Spinner } from "./Spinner";
import { StageSky } from "./StageSky";
import { composeHLG, setupWebGLHdr, WebGLHdr } from "./hdr";
import { Wordmark } from "./Wordmark";
import { prefersReducedMotion } from "../lib/motion";
import {
	currentSky,
	onSkyChange,
	SkyPreset,
	skyOffset,
	startSkyPan,
	sunDirection,
} from "../lib/skies";
import { REST_FOV } from "../lib/skyLens";
import type { StageSupport } from "../lib/support";
import { debugLog } from "../lib/debug";

const H = VRMHumanBoneName;

// Where the camera looks and how far back it sits, relative to the head bone. It
// stays level, so the horizon of the sky behind her sits at her eye level.
const PORTRAIT = { lookDrop: 0.02, distance: 2.4, height: 0 };
const FULL_BODY = { distance: 5.8 };

// How far behind her the 3D wordmark floats.
const WORDMARK_DEPTH = 0.95;
// ...or how far in front of her on narrow frames.
const WORDMARK_FRONT = 0.4;
// While the dance camera flies around, the wordmark stands in the world behind her,
// a sign over the stage, instead of riding on a camera that cuts and spins.
const WORDMARK_STAGE = { y: 2.6, z: -3, width: 5.5 };

// The scene starts frozen in a rest state (what the prerendered poster shows) and
// eases into its idle motion, cursor tracking and moving sunlight over this long.
const LIVE_BLEND_SECONDS = 1.2;
// ...after holding still for as long as the canvas takes to fade in over the poster
// (the .canvas opacity transition in AlulaModel.module.css), so the crossfade is
// between two identical frames
const LIVE_HOLD_SECONDS = 0.35;
// 1.5s of spring physics at 60Hz before the first frame, see settleSprings
const SPRING_SETTLE_STEPS = 90;

// Scene layout in units of the frame's half height, anchored to the right edge on
// wide frames and the centre on narrow ones. That keeps it the same size whatever the
// frame's width, so the prerendered poster (sized by height and pinned the same way)
// lines up at any window size. The numbers reproduce the layout at the posters' own
// aspect ratios (scripts/prerenderHero.mjs).
const MODEL_FROM_RIGHT = 0.7565;
const WORD_FROM_RIGHT = 1.7217;
const WORD_WIDTH_WIDE = 1.5652;
const WORD_WIDTH_NARROW = 0.944;

// Ievan Polkka's tempo and where its first beat lands in the audio, measured from
// the track's onsets (the motion bounces at the same tempo). The wordmark pulses
// on each beat.
const DANCE_BPM = 119.06;
const DANCE_BEAT_OFFSET = 0.021;
// how long to wait for the music before dancing without it
const AUDIO_TIMEOUT_MS = 15000;

export interface AlulaStageOptions {
	canvas: HTMLCanvasElement;
	modelUrl: string;
	/** VMD motion, plain or LZ4 framed; fetched when she's first asked to dance. */
	danceUrl?: string;
	/** Music for the dance, drives its timing. Optional, she dances without it. */
	danceAudioUrl?: string;
	/**
	 * false leaves the sky out, for the prerendered posters: they go over the page's
	 * own still sky (Sky.tsx), which they're not always centred on.
	 */
	sky?: boolean;
}

type Mode = "idle" | "loading" | "dance";

// The key light sits this far from her, towards the sun; only the shadow camera
// cares, the light itself is directional.
const SUN_DISTANCE = 10;
// half size of the shadow box around her: her reach, and a bit for her dance steps
const SHADOW_EXTENT = 2;
const SHADOW_MAP_SIZE = 512;

// For spring joints the model leaves with neither stiffness nor gravity, see
// relaxLooseSprings: just enough to hang and still flop.
const LOOSE_SPRING = { stiffness: 0.2, gravityPower: 0.3, dragForce: 0.4 };

/**
 * Her ear tips come with no stiffness and no gravity, so nothing brings them back
 * once a dance move flicks them up: they stayed pointing up for most of the dance.
 */
function relaxLooseSprings(vrm: VRM) {
	for (const { settings } of vrm.springBoneManager?.joints ?? [])
		if (!settings.stiffness && !settings.gravityPower)
			Object.assign(settings, LOOSE_SPRING);
}

const DEBUG_TICKS = 40;
const round = (n: number) => Math.round(n * 1e4) / 1e4;
const vec = (v: { toArray(): number[] }) => v.toArray().map(round);

export class AlulaStage {
	#renderer: WebGPURenderer;
	#pipeline?: RenderPipeline;
	#scene = new Scene();
	#camera = new PerspectiveCamera(REST_FOV, 1, 0.1, 200);
	#timer = new Timer();
	/** Set when the WebGL 2 fallback managed to get an HDR drawing buffer. */
	#webglHdr: WebGLHdr | null = null;
	/** Whether values past 1.0 reach the screen as HDR. */
	#hdrOutput = false;
	#webgpuError: string | null = null;
	#vrm?: VRM;
	#disposed = false;
	#running = false;
	#frame = 0;

	#time = 0;
	#mode: Mode = "idle";
	#pointer = { x: 0, y: 0 };
	#smoothPointer = { x: 0, y: 0 };
	#lookTarget = new Object3D();
	#nextBlink = 2;
	#blinkStart = -1;
	#headY = 1.3;
	#hipsY = 0.8;
	#cameraBlend = 0;
	#cameraLook = new Vector3();
	#follow = new Vector3();
	#hipsWorld = new Vector3();
	// canvas size in CSS pixels, and how much taller it is than the sky frame
	#size = new Vector2(1, 1);
	#overscan = 1;
	#wordmark = new Wordmark();
	// lit to match the sky behind her, see lib/skies.ts
	#sky: SkyPreset = currentSky();
	#stageSky = new StageSky();
	#key = new DirectionalLight();
	// what the key light points at: her, so the dance shadow's small box follows her
	#sunTarget = new Object3D();
	#ground: Ground | null = null;
	#ambient = new HemisphereLight();
	#unsubscribeSky: () => void = () => {};
	#raycaster = new Raycaster();
	#ndc = new Vector2(10, 10);
	/** Where she stands, pushed right on wide frames so the wordmark has room. */
	#modelX = 0;
	#modelNdcX = 0;
	/** 0 = the static poster state, 1 = fully alive, see LIVE_BLEND_SECONDS. */
	#live = 0;
	/** Seconds the loop has been running, drives `live`. */
	#liveClock = 0;
	#staticSun = { x: 0, y: 0, z: 0 };
	#liveSun = { x: 0, y: 0, z: 0 };

	#mixer?: AnimationMixer;
	#danceAction?: AnimationAction;
	#dancePose?: VRMPose;
	#ik?: VRMIKHandler;
	#danceLoading?: Promise<boolean>;
	#danceCamera: DanceCamera | null = null;
	#music?: Music;
	/** what the latest setDancing call asked for, a slow load mustn't override it */
	#wantDance = false;
	#spinner = new Spinner();
	#leek = new Leek();

	#options: AlulaStageOptions;

	constructor(options: AlulaStageOptions) {
		this.#options = options;
		// WebGPU with a half-float canvas gets extended tone mapping, so anything past
		// 1.0 shows as HDR where the display allows. Falls back to WebGL 2 on its own.
		this.#renderer = new WebGPURenderer({
			canvas: options.canvas,
			alpha: true,
			antialias: true,
			outputType: HalfFloatType,
		});
		this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.#keepFallbackReason();
		this.#setupShadow();

		this.#scene.add(
			this.#key,
			this.#ambient,
			this.#camera,
			this.#lookTarget,
			this.#spinner.group,
			this.#sunTarget,
		);
		this.#applySky();
		this.#unsubscribeSky = onSkyChange(() => {
			this.#sky = currentSky();
			this.#applySky();
			this.#stageSky
				.set(this.#sky, this.#hdrOutput)
				.then(() => {
					if (this.#vrm && !this.#running) this.#tick(0);
				})
				.catch((e) => console.warn("Sky image failed to load", e));
		});
		this.#camera.add(this.#wordmark.group);
	}

	/**
	 * three falls back to WebGL 2 on any WebGPU error and only says WebGPU is "not
	 * available", so keep the actual reason for the warnings on the page.
	 */
	#keepFallbackReason() {
		const renderer = this.#renderer as unknown as {
			_getFallback: ((error: unknown) => unknown) | null;
		};
		const fallback = renderer._getFallback;
		if (!fallback) return;
		renderer._getFallback = (error) => {
			console.warn("WebGPU failed, using WebGL 2:", error);
			this.#webgpuError = !("gpu" in navigator)
				? window.isSecureContext
					? "unsupported browser"
					: "needs HTTPS"
				: (error instanceof Error ? error.message : String(error))
						// "THREE.WebGPUBackend: Unable to create WebGPU adapter."
						.replace(/^THREE\.\w+: /, "")
						.replace(
							/^Unable to create WebGPU adapter/,
							"no adapter",
						)
						.replace(/\.$/, "")
						.replace(/^\w/, (c) => c.toLowerCase());
			return fallback(error);
		};
	}

	#setMode(mode: Mode) {
		debugLog?.("stage", "mode", `${this.#mode} -> ${mode}`);
		this.#mode = mode;
	}

	/** What the renderer ended up with, known once load() has run. */
	get support(): StageSupport {
		return { webgpuError: this.#webgpuError, hdr: this.#hdrOutput };
	}

	async load() {
		await this.#renderer.init();
		if (this.#disposed) return;
		this.#webglHdr = setupWebGLHdr(this.#renderer);
		const webgl = (this.#renderer.backend as { isWebGLBackend?: boolean })
			.isWebGLBackend;
		// WebGPU gets it from its half float canvas, WebGL only with an HDR buffer
		this.#hdrOutput =
			window.matchMedia("(dynamic-range: high)").matches &&
			(!webgl || !!this.#webglHdr);
		debugLog?.("stage", "renderer", {
			backend: webgl ? "webgl2" : "webgpu",
			webgpuError: this.#webgpuError,
			webglHdr: this.#webglHdr?.mode ?? null,
			hdrOutput: this.#hdrOutput,
			dpr: window.devicePixelRatio,
		});
		const drawSky = this.#options.sky !== false;
		const skyReady =
			drawSky && this.#stageSky.set(this.#sky, this.#hdrOutput);

		// Only the wordmark writes into the "glow" target (see Wordmark), so only it
		// blooms and only it may go past 1.0. Everything else is clamped to SDR, which
		// is how she looked on the old WebGL canvas. Alpha is the scene's, so the glow
		// adds light over the page instead of painting a background.
		const scenePass = pass(this.#scene, this.#camera);
		scenePass.setMRT(mrt({ output, glow: float(0) }));
		const color = scenePass.getTextureNode("output");
		const glowMask = scenePass.getTextureNode("glow").r;
		const bloomed = bloom(color.mul(glowMask), 0.14, 0.12, 0.9);
		const scene = mix(color.rgb.min(1), color.rgb, glowMask);
		// the sky goes behind her, premultiplied like the scene
		const sky = drawSky ? this.#stageSky.node : vec4(0);
		const behind = color.a.oneMinus();
		const rgb = scene.add(sky.rgb.mul(behind));
		const coverage = color.a.add(sky.a.mul(behind));
		// an HLG canvas takes the encoded signal as is, no sRGB transfer on top
		const signal =
			this.#webglHdr?.mode === "hlg"
				? composeHLG(rgb, coverage, bloomed.rgb)
				: renderOutput(vec4(rgb.add(bloomed.rgb), coverage));
		// tiny noise so the sky's smooth gradients don't band in an 8-bit canvas
		const dither = fract(
			sin(dot(screenCoordinate, vec2(12.9898, 78.233))).mul(43758.5453),
		)
			.sub(0.5)
			.div(255);
		this.#pipeline = new RenderPipeline(
			this.#renderer,
			vec4(signal.rgb.add(dither.mul(signal.a)), signal.a),
		);
		this.#pipeline.outputColorTransform = false;

		const loader = new GLTFLoader();
		loader.register(
			(parser) =>
				new VRMLoaderPlugin(parser, {
					mtoonMaterialPlugin: new MToonMaterialLoaderPlugin(parser, {
						materialType: MToonNodeMaterial,
					}),
				}),
		);
		const gltf = await loader.loadAsync(this.#options.modelUrl);
		await skyReady;
		const vrm: VRM = gltf.userData.vrm;
		if (this.#disposed) {
			VRMUtils.deepDispose(gltf.scene);
			return;
		}

		VRMUtils.removeUnnecessaryVertices(gltf.scene);
		VRMUtils.combineSkeletons(gltf.scene);
		VRMUtils.rotateVRM0(vrm);
		vrm.scene.traverse((obj) => {
			obj.frustumCulled = false;
			obj.castShadow = true;
		});
		this.#scene.add(vrm.scene);
		relaxLooseSprings(vrm);
		this.#vrm = vrm;

		this.#leek.attach(vrm);
		vrm.scene.updateMatrixWorld(true);
		const world = new Vector3();
		vrm.humanoid.getNormalizedBoneNode(H.Head)?.getWorldPosition(world);
		this.#headY = world.y;
		vrm.humanoid.getNormalizedBoneNode(H.Hips)?.getWorldPosition(world);
		this.#hipsY = world.y;

		if (vrm.lookAt) vrm.lookAt.target = this.#lookTarget;

		this.#applyIdlePose(0, 0);
		vrm.update(0);
		vrm.springBoneManager?.reset();
		this.#cameraLook.set(0, this.#headY - PORTRAIT.lookDrop, 0);
		this.resize();
		this.#settleSprings();
		// Frame 0 through the normal path with no time passed: pointer centred, nothing
		// eased yet. This is what the prerendered poster shows, so the swap is seamless,
		// and later frames ease from here to wherever the pointer really is.
		this.#tick(0);
	}

	/** Pointer position in -1..1 across the canvas, y pointing down. */
	setPointer(x: number, y: number) {
		this.#ndc.set(x, -y);
		this.#pointer.x = MathUtils.clamp(x, -1.5, 1.5);
		// Biased down a bit, otherwise she stares over your cursor.
		this.#pointer.y = MathUtils.clamp(y + 0.4, -1.5, 1.5);
	}

	get dancing() {
		return this.#mode === "dance";
	}

	/**
	 * Resolves to false when there is no usable dance motion. Must be called from
	 * the click that asks for it: the music gets unlocked while still inside it.
	 */
	async setDancing(dance: boolean) {
		const vrm = this.#vrm;
		if (!vrm) return false;
		this.#wantDance = dance;

		if (!dance) {
			this.#setMode("idle");
			this.#music?.stop();
			this.#danceAction?.stop();
			this.#ik?.disableAll();
			this.#dancePose = undefined;
			vrm.humanoid.resetNormalizedPose();
			vrm.expressionManager?.resetValues();
			vrm.springBoneManager?.reset();
			return true;
		}

		const musicUrl = this.#options.danceAudioUrl;
		if (musicUrl) (this.#music ??= new Music(musicUrl)).unlock();
		// she zooms out with a spinner over her head while everything loads
		if (!this.#danceLoading) this.#setMode("loading");
		this.#danceLoading ??= this.#loadDance(vrm);
		const ok = await this.#danceLoading;
		if (!this.#wantDance || this.#disposed) return false;
		if (!ok) {
			this.#setMode("idle");
			return false;
		}

		this.#setMode("dance");
		vrm.humanoid.resetNormalizedPose();
		this.#dancePose = undefined;
		this.#danceAction!.reset().play();
		vrm.springBoneManager?.reset();
		this.#music?.play(this.#danceAction!.getClip().duration);
		return true;
	}

	/**
	 * Creates the music and starts it muted, while still inside the click that asked
	 * for the dance: some browsers only allow sound from a user gesture, and the
	 * downloads can take longer than that lasts. It restarts properly once loaded.
	 */
	/** Loads the dance module and motion, alongside waiting for the music. */
	async #loadDance(vrm: VRM) {
		const { danceUrl } = this.#options;
		if (!danceUrl) return false;
		try {
			const [dance] = await Promise.all([
				import("./dance").then(({ loadDance }) =>
					loadDance(danceUrl, vrm),
				),
				this.#music?.ready(AUDIO_TIMEOUT_MS),
			]);
			this.#ik = dance.ik;
			this.#mixer = dance.mixer;
			this.#danceAction = dance.mixer.clipAction(dance.clip);
			this.#danceCamera = dance.camera;
			this.#ground = dance.ground;
			this.#scene.add(dance.ground.mesh);
			return true;
		} catch (e) {
			console.warn(
				"Couldn't load the dance, she'll just vibe instead",
				e,
			);
			return false;
		}
	}

	/** Resolves once the music can play through, or drops it on error or timeout. */
	start() {
		if (this.#running || this.#disposed) return;
		this.#running = true;
		this.#timer.reset();
		startSkyPan();
		const loop = () => {
			if (!this.#running) return;
			this.#timer.update();
			this.#tick(Math.min(this.#timer.getDelta(), 1 / 20));
			this.#frame = requestAnimationFrame(loop);
		};
		this.#frame = requestAnimationFrame(loop);
	}

	stop() {
		this.#running = false;
		cancelAnimationFrame(this.#frame);
	}

	resize() {
		const canvas = this.#renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (!width || !height) return;
		this.#renderer.setSize(width, height, false);
		this.#size.set(width, height);
		// set in Hero.module.css, the canvas pokes out above the sky frame for her ears
		this.#overscan =
			parseFloat(
				getComputedStyle(canvas).getPropertyValue("--stage-overscan"),
			) || 1;
		this.#stageSky.resize(
			canvas.height,
			this.#renderer.getPixelRatio(),
			this.#overscan,
			parseFloat(
				getComputedStyle(canvas).getPropertyValue("--frame-radius"),
			) || 0,
		);
		this.#camera.aspect = width / height;
		this.#camera.updateProjectionMatrix();
		debugLog?.("stage", "resize", {
			css: `${width}x${height}`,
			buffer: `${canvas.width}x${canvas.height}`,
			pixelRatio: this.#renderer.getPixelRatio(),
			overscan: this.#overscan,
		});
		// resizing clears the canvas, so a paused stage needs its frame back
		if (this.#vrm && !this.#running) this.#tick(0);
	}

	dispose() {
		this.#unsubscribeSky();
		this.#disposed = true;
		this.stop();
		this.#mixer?.stopAllAction();
		this.#pipeline?.dispose();
		if (this.#vrm) VRMUtils.deepDispose(this.#vrm.scene);
		this.#wordmark.dispose();
		this.#spinner.dispose();
		this.#leek.dispose();
		this.#ground?.dispose();
		this.#music?.dispose();
		this.#renderer.dispose();
		this.#stageSky.dispose();
	}

	/**
	 * Steps the hair and ear physics with the static pose held, so they start out
	 * hanging naturally. Straight after a reset they sit in the model's rest shape,
	 * and the first real frame would swing them into place all at once, a visible
	 * snap right after the poster hands over. Runs after resize(), which sets the
	 * layout the pose depends on.
	 */
	#settleSprings() {
		const vrm = this.#vrm;
		if (!vrm?.springBoneManager) return;
		for (let i = 0; i < SPRING_SETTLE_STEPS; i++) {
			this.#applyIdlePose(0, 0);
			vrm.update(1 / 60);
		}
	}

	#applySky() {
		const { key, ambient } = this.#sky;
		this.#key.color.set(key.color);
		this.#key.intensity = key.intensity;
		this.#ambient.color.set(ambient.sky);
		this.#ambient.groundColor.set(ambient.ground);
		this.#ambient.intensity = ambient.intensity;
		this.#updateSunlight();
	}

	/** Points the key light from wherever the sun currently is in the panning sky. */
	/**
	 * Her shadow on the lawn while she dances. Low resolution, since the frame
	 * budget is already tight; the soft toon look hides it.
	 */
	#setupShadow() {
		this.#renderer.shadowMap.enabled = true;
		// Always on: only the lawn receives it, and that's only drawn while she dances,
		// so that's the only time the shadow pass runs. Toggling it instead frees the
		// shadow map three shares between materials, under the lawn's feet.
		this.#key.castShadow = true;
		this.#key.target = this.#sunTarget;
		const { shadow } = this.#key;
		shadow.mapSize.setScalar(SHADOW_MAP_SIZE);
		const camera = shadow.camera;
		camera.left = camera.bottom = -SHADOW_EXTENT;
		camera.right = camera.top = SHADOW_EXTENT;
		camera.near = SUN_DISTANCE - SHADOW_EXTENT;
		// deep enough for a low dusk sun's long shadow across the lawn
		camera.far = SUN_DISTANCE * 3;
		shadow.bias = -0.002;
		shadow.normalBias = 0.02;
	}

	#updateSunlight() {
		// the static state lights her as in the posters, from the start of the pan
		sunDirection(this.#sky, 0, this.#staticSun);
		sunDirection(
			this.#sky,
			skyOffset(!prefersReducedMotion()),
			this.#liveSun,
		);
		this.#sunTarget.position.set(this.#hipsWorld.x, 0, this.#hipsWorld.z);
		this.#key.position
			.set(
				MathUtils.lerp(this.#staticSun.x, this.#liveSun.x, this.#live),
				MathUtils.lerp(this.#staticSun.y, this.#liveSun.y, this.#live),
				MathUtils.lerp(this.#staticSun.z, this.#liveSun.z, this.#live),
			)
			.setLength(SUN_DISTANCE)
			.add(this.#sunTarget.position);
	}

	/**
	 * Where the cursor is horizontally, relative to where she stands. The "relative
	 * to her" part depends on the canvas shape, so it fades in with `live`: in the
	 * static state she faces straight ahead whatever the window size, like in the
	 * posters, which are rendered at one fixed size.
	 */
	#pointerFromModel() {
		return this.#smoothPointer.x - this.#modelNdcX * this.#live;
	}

	/** Where the music is as heard, or null when it isn't playing. */
	#musicTime() {
		return this.#music?.time() ?? null;
	}

	#draw() {
		this.#webglHdr?.ensure();
		if (this.#pipeline) this.#pipeline.render();
		else this.#renderer.render(this.#scene, this.#camera);
	}

	#tick(dt: number) {
		const vrm = this.#vrm;
		if (!vrm) return;
		this.#time += dt;
		this.#liveClock += dt;
		this.#live = MathUtils.smootherstep(
			(this.#liveClock - LIVE_HOLD_SECONDS) / LIVE_BLEND_SECONDS,
			0,
			1,
		);

		const ease = 1 - Math.exp(-dt * 6);
		const targetX = this.#pointer.x * this.#live;
		const targetY = this.#pointer.y * this.#live;
		this.#smoothPointer.x += (targetX - this.#smoothPointer.x) * ease;
		this.#smoothPointer.y += (targetY - this.#smoothPointer.y) * ease;

		if (this.#mode === "dance" && this.#mixer) {
			const { humanoid } = vrm;
			if (this.#dancePose) humanoid.setNormalizedPose(this.#dancePose);
			const music = this.#musicTime();
			if (music !== null && this.#danceAction) {
				// The music is the clock, so she stays in sync through stutters and tab
				// switches. The motion (89.5s) is shorter than the song (151.5s), so the
				// song loops where the motion ends (Music.play) and both restart together.
				this.#danceAction.time = music;
				this.#mixer.update(0);
			} else {
				this.#mixer.update(dt);
			}
			vrm.scene.updateMatrixWorld();
			this.#ik?.update();
			this.#dancePose = humanoid.getNormalizedPose();
		} else {
			this.#applyIdlePose(this.#time, dt);
		}

		this.#lookTarget.position.set(
			this.#modelX + this.#pointerFromModel() * 1.2,
			this.#headY - this.#smoothPointer.y * 0.8,
			2.5,
		);

		const dancing = this.#mode === "dance";
		this.#leek.group.visible = dancing;
		if (this.#ground) {
			this.#ground.mesh.visible = dancing;
			this.#ground.mesh.position.x = this.#modelX;
		}
		vrm.update(dt);
		this.#updateCamera(dt);
		this.#updateSunlight();
		// sharp attack on the beat, then decay, following the song (or the motion)
		let pulse = 0;
		if (this.#mode === "dance" && this.#danceAction) {
			const songTime = this.#musicTime() ?? this.#danceAction.time;
			const beat = ((songTime - DANCE_BEAT_OFFSET) * DANCE_BPM) / 60;
			if (beat >= 0) pulse = Math.pow(1 - (beat % 1), 3);
		}
		const head = vrm.humanoid.getNormalizedBoneNode(H.Head);
		if (head)
			this.#spinner.update(
				this.#time,
				dt,
				this.#mode === "loading",
				head,
				this.#camera,
			);
		this.#wordmark.update(
			this.#time,
			dt,
			this.#smoothPointer,
			pulse,
			this.#live,
		);
		this.#raycaster.setFromCamera(this.#ndc, this.#camera);
		this.#wordmark.hover(this.#raycaster, this.#time);
		this.#draw();

		// the static frame and the first ticks after it, to compare with the prerender
		if (this.#debugTicks++ < DEBUG_TICKS)
			debugLog?.(
				"stage",
				`tick ${this.#debugTicks} ${this.#running ? "loop" : "static"}`,
				this.#debugSnapshot?.(dt),
			);
	}

	#debugTicks = 0;

	/** Everything that decides what a frame looks like, rounded for diffing. */
	#debugSnapshot =
		debugLog &&
		((dt: number) => {
			const vrm = this.#vrm!;
			const canvas = this.#renderer.domElement;
			const pose = vrm.humanoid.getNormalizedPose();
			const bone = (name: VRMHumanBoneName) => {
				const node = vrm.humanoid.getNormalizedBoneNode(name);
				return node
					? { p: vec(node.position), q: vec(node.quaternion) }
					: null;
			};
			let springs = 0;
			let i = 0;
			for (const joint of vrm.springBoneManager?.joints ?? []) {
				const q = joint.bone.quaternion;
				springs += (++i % 7) * (q.x + 2 * q.y + 3 * q.z);
			}
			const expressions: Record<string, number> = {};
			for (const e of vrm.expressionManager?.expressions ?? [])
				if (e.weight) expressions[e.expressionName] = round(e.weight);

			return {
				dt: round(dt),
				time: round(this.#time),
				liveClock: round(this.#liveClock),
				live: round(this.#live),
				canvasOpacity: getComputedStyle(canvas).opacity,
				dpr: window.devicePixelRatio,
				css: [canvas.clientWidth, canvas.clientHeight],
				buffer: [canvas.width, canvas.height],
				pointer: [round(this.#pointer.x), round(this.#pointer.y)],
				smoothPointer: [
					round(this.#smoothPointer.x),
					round(this.#smoothPointer.y),
				],
				camera: {
					aspect: round(this.#camera.aspect),
					fov: this.#camera.fov,
					p: vec(this.#camera.position),
					q: vec(this.#camera.quaternion),
				},
				cameraBlend: round(this.#cameraBlend),
				modelX: round(this.#modelX),
				modelNdcX: round(this.#modelNdcX),
				vrmScene: vec(vrm.scene.position),
				lookTarget: vec(this.#lookTarget.position),
				hips: bone(H.Hips),
				spine: bone(H.Spine),
				chest: bone(H.Chest),
				neck: bone(H.Neck),
				head: bone(H.Head),
				leftEye: bone(H.LeftEye),
				leftUpperArm: bone(H.LeftUpperArm),
				poseBones: Object.keys(pose).length,
				springs: round(springs),
				expressions,
				key: {
					p: vec(this.#key.position),
					color: this.#key.color.getHexString(),
					i: this.#key.intensity,
				},
				ambient: [
					this.#ambient.color.getHexString(),
					this.#ambient.groundColor.getHexString(),
					this.#ambient.intensity,
				],
				wordmark: this.#wordmark.debugSnapshot?.(),
				hdr: this.#webglHdr?.mode ?? "none",
			};
		});

	#applyIdlePose(t: number, dt: number) {
		const vrm = this.#vrm!;
		const { humanoid, expressionManager } = vrm;
		const bone = (name: VRMHumanBoneName) =>
			humanoid.getNormalizedBoneNode(name);
		const px = this.#pointerFromModel();
		const py = this.#smoothPointer.y;

		// idle motion fades in from the static rest pose
		const breathe = Math.sin(t * 2.1) * this.#live;
		const sway = Math.sin(t * 1.3) * this.#live;

		const hips = bone(H.Hips);
		if (hips) {
			hips.position.y = this.#hipsY + breathe * 0.004;
			hips.rotation.set(0, px * 0.12, sway * 0.03);
		}
		bone(H.Spine)?.rotation.set(
			breathe * 0.02 + py * 0.04,
			px * 0.1,
			-sway * 0.03,
		);
		bone(H.Chest)?.rotation.set(breathe * 0.015, px * 0.08, 0);
		bone(H.Neck)?.rotation.set(-py * 0.12, px * 0.22, 0);
		bone(H.Head)?.rotation.set(
			-py * 0.1,
			px * 0.18,
			Math.sin(t * 0.7) * 0.07 * this.#live,
		);

		// T-pose arms down to a relaxed hang.
		const armSwing = Math.sin(t * 1.3 + 0.6) * 0.035 * this.#live;
		bone(H.LeftUpperArm)?.rotation.set(0.1, 0, -1.2 + armSwing);
		bone(H.RightUpperArm)?.rotation.set(0.1, 0, 1.2 + armSwing);
		bone(H.LeftLowerArm)?.rotation.set(0, -0.35, 0);
		bone(H.RightLowerArm)?.rotation.set(0, 0.35, 0);
		bone(H.LeftHand)?.rotation.set(0, 0, -0.15);
		bone(H.RightHand)?.rotation.set(0, 0, 0.15);

		if (!expressionManager) return;
		if (dt > 0 && this.#blinkStart < 0 && t > this.#nextBlink)
			this.#blinkStart = t;
		let blink = 0;
		if (this.#blinkStart >= 0) {
			const age = (t - this.#blinkStart) / 0.16;
			blink = age < 1 ? Math.sin(age * Math.PI) : 0;
			if (age >= 1) {
				this.#blinkStart = -1;
				this.#nextBlink = t + 1.8 + Math.random() * 3.5;
			}
		}
		expressionManager.setValue("blink", blink);
	}

	#updateCamera(dt: number) {
		// pulled back to full body for the dance, and already while it loads
		const goal = this.#mode === "idle" ? 0 : 1;
		this.#cameraBlend +=
			(goal - this.#cameraBlend) * (1 - Math.exp(-dt * 2.5));
		const b = MathUtils.smootherstep(this.#cameraBlend, 0, 1);

		// Wide frames: she stands right of centre and the wordmark floats behind her on
		// the left. Narrow frames: she's centred and the word sits over her head.
		// laid out for the idle lens; the dance camera swaps its own fov in afterwards
		const halfTan = Math.tan(MathUtils.degToRad(REST_FOV / 2));
		const aspect = this.#size.x / this.#size.y;
		const wide = aspect > 1.1;
		const halfH = PORTRAIT.distance * halfTan;
		this.#modelX = wide ? halfH * (aspect - MODEL_FROM_RIGHT) : 0;
		this.#modelNdcX = this.#modelX / (halfH * aspect);
		if (this.#vrm) this.#vrm.scene.position.x = this.#modelX;

		// The dance wanders around the stage, so keep her hips centred.
		const hips = this.#vrm?.humanoid.getNormalizedBoneNode(H.Hips);
		if (hips && this.#mode === "dance")
			hips.getWorldPosition(this.#hipsWorld);
		else this.#hipsWorld.set(0, 0, 0);
		this.#follow.x +=
			(this.#hipsWorld.x - this.#follow.x) * (1 - Math.exp(-dt * 3));
		this.#follow.z +=
			(this.#hipsWorld.z - this.#follow.z) * (1 - Math.exp(-dt * 3));

		const portraitY = this.#headY - PORTRAIT.lookDrop;
		// the canvas pokes out above the sky frame for her ears, so aim a bit high to
		// keep the whole dancing body (and her jumps) inside the frame
		const bodyY = this.#headY * 0.76;
		const lookY = MathUtils.lerp(portraitY, bodyY, b);
		const distance = MathUtils.lerp(
			PORTRAIT.distance,
			FULL_BODY.distance,
			b,
		);

		// The wordmark rides on the camera, so the dance's camera moves can't swing it
		// around. It keeps its idle spot and size on screen but is pushed back as the
		// camera pulls away, staying behind her. Narrow frames have no room beside or
		// above her, so there it sits in front, low across the frame like a title screen.
		const wordZ = wide ? -WORDMARK_DEPTH : WORDMARK_FRONT;
		const idleDepth = PORTRAIT.distance - wordZ;
		const depthScale = (distance - wordZ) / idleDepth;
		const wordHalfH = idleDepth * halfTan;
		const wordWidth =
			wordHalfH * (wide ? WORD_WIDTH_WIDE : WORD_WIDTH_NARROW);
		this.#wordmark.group.scale.setScalar(
			(wordWidth / this.#wordmark.width) * depthScale,
		);
		this.#wordmark.group.position
			.set(
				wide ? wordHalfH * (aspect - WORD_FROM_RIGHT) : 0,
				wide ? -0.04 : -0.34,
				-idleDepth,
			)
			.multiplyScalar(depthScale);

		this.#cameraLook.set(this.#follow.x, lookY, this.#follow.z);
		this.#camera.position.set(
			this.#follow.x + this.#smoothPointer.x * -0.12 * (1 - b),
			lookY + PORTRAIT.height + this.#smoothPointer.y * 0.06 * (1 - b),
			this.#follow.z + distance,
		);
		this.#camera.lookAt(this.#cameraLook);
		this.#applyDanceCamera();

		this.#stageSky.update(this.#camera, skyOffset(!prefersReducedMotion()));
	}

	/**
	 * While she dances, the motion's own camera work takes over, on the song's clock.
	 * It's authored around a dancer at the origin, so it follows her layout offset.
	 */
	#applyDanceCamera() {
		const track =
			this.#mode === "dance" && this.#danceAction
				? this.#danceCamera
				: null;
		let fov = REST_FOV;
		if (track) {
			const time = this.#musicTime() ?? this.#danceAction!.time;
			fov = track.sample(
				time,
				this.#camera.position,
				this.#camera.quaternion,
			);
			this.#camera.position.x += this.#modelX;
		}

		const word = this.#wordmark.group;
		const parent = track ? this.#scene : this.#camera;
		if (word.parent !== parent) parent.add(word);
		if (track) {
			word.position.set(this.#modelX, WORDMARK_STAGE.y, WORDMARK_STAGE.z);
			word.scale.setScalar(WORDMARK_STAGE.width / this.#wordmark.width);
		}
		this.#camera.fov = fov;
		const { x: width, y: height } = this.#size;
		if (track) {
			// The track frames the whole picture, which here is the sky frame, not the
			// taller canvas; the page clips the rest meanwhile. The picture is centred
			// where she stands at idle, clear of the speech bubble on wide frames.
			const frame = height / this.#overscan;
			const shift = (this.#modelNdcX * width) / 2;
			this.#camera.setViewOffset(
				width,
				frame,
				-shift,
				frame - height,
				width,
				height,
			);
		} else {
			this.#camera.clearViewOffset();
			// setViewOffset took the frame's aspect
			this.#camera.aspect = width / height;
			this.#camera.updateProjectionMatrix();
		}
	}
}
