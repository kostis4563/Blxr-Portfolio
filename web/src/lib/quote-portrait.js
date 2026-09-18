import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TextureLoader,
  WebGLRenderer,
} from 'three'

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const FRAG = `
  uniform sampler2D uMap;
  uniform vec2 uCover;
  uniform vec2 uPointer;
  uniform float uHover;
  uniform float uPulse;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * uCover + 0.5;

    vec2 d = vUv - uPointer;
    float dist = length(d);
    float ring = sin(dist * 34.0 - uTime * 4.0) * 0.007 * uHover * smoothstep(0.55, 0.0, dist);
    uv += (d / max(dist, 0.001)) * ring;

    uv = (uv - 0.5) * (1.0 - uPulse * 0.035) + 0.5;
    float split = uPulse * 0.014;
    vec3 c = vec3(
      texture2D(uMap, uv + vec2(split, 0.0)).r,
      texture2D(uMap, uv).g,
      texture2D(uMap, uv - vec2(split, 0.0)).b
    );

    float grey = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(grey), c, 0.15 + 0.85 * uHover);

    float grain = (hash(vUv * 900.0 + fract(uTime) * 100.0) - 0.5) * 0.06;
    float vig = smoothstep(1.0, 0.4, length(vUv - 0.5));
    c = (c + grain) * mix(0.82, 1.0, vig);

    gl_FragColor = vec4(c, 1.0);
  }
`

export function createPortrait(canvas, src, onReady) {
  let renderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' })
  } catch {
    return null
  }

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: null },
      uCover: { value: [1, 1] },
      uPointer: { value: [0.5, 0.5] },
      uHover: { value: 0 },
      uPulse: { value: 0 },
      uTime: { value: 0 },
    },
  })
  scene.add(new Mesh(new PlaneGeometry(2, 2), material))

  new TextureLoader().load(src, (texture) => {
    material.uniforms.uMap.value = texture
    onReady?.()
  })

  const target = { x: 0.5, y: 0.5, hover: 0 }
  let pulse = 0
  let raf = 0
  let width = 0
  let height = 0

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h || (w === width && h === height)) return
    width = w
    height = h
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(w, h, false)
    const aspect = w / h
    material.uniforms.uCover.value = [Math.min(aspect, 1), Math.min(1 / aspect, 1)]
  }

  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    const u = material.uniforms
    u.uTime.value = now / 1000
    u.uPointer.value[0] += (target.x - u.uPointer.value[0]) * 0.12
    u.uPointer.value[1] += (target.y - u.uPointer.value[1]) * 0.12
    u.uHover.value += (target.hover - u.uHover.value) * 0.08
    pulse *= 0.9
    u.uPulse.value = pulse
    renderer.render(scene, camera)
  }

  resize()

  return {
    start() {
      if (raf) return
      raf = requestAnimationFrame(frame)
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
    },
    resize,
    setPointer(x, y) {
      if (x == null) { target.hover = 0; return }
      target.x = x
      target.y = 1 - y
      target.hover = 1
    },
    pulse() {
      pulse = 1
    },
    dispose() {
      cancelAnimationFrame(raf)
      material.uniforms.uMap.value?.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
