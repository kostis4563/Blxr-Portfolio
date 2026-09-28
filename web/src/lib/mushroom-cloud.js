const GROUND = 0.88
const unit = (width, height) => Math.min(width * 0.014, height * 0.011)
const BURST = 10
const EYE = 4
const DISTANCE = 170
const PIXELS = 1300000
const SIZE = 64
const CELLS = [4, 8, 16, 5]

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value))

const rise = (t) => BURST + 27 * (1 - Math.exp(-t / 2.4)) + 0.5 * t
const ring = (t) => 13 * (1 - Math.exp(-((t / 2.4) ** 1.5)))
const tube = (t) => 6 * (1 - Math.exp(-t / 0.12)) + 6 * (1 - Math.exp(-t / 2.2))
const flat = (t) => 0.66 + 0.34 * Math.exp(-((t / 2) ** 2))

const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }
`

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D grain;
uniform vec3 view;
uniform vec4 cap;
uniform float stem;
uniform vec2 surge;
uniform vec3 fire;
uniform float day;
out vec4 pixel;

const float EYE = ${EYE.toFixed(1)};
const float DISTANCE = ${DISTANCE.toFixed(1)};
const float STEM = 2.6;
const float TILE = 26.0;
const vec3 SUN = normalize(vec3(-0.6, 0.6, 0.5));

vec4 grainAt(vec3 p) {
  return textureLod(grain, p / TILE, 0.0);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec2 tubeOf(vec3 p) {
  return vec2(length(p.xz) - cap.x, p.y - cap.y);
}

vec3 parts(vec3 p) {
  vec2 q = tubeOf(p);
  float r = length(p.xz);
  float head = (length(vec2(q.x, q.y / cap.w)) - cap.z) * cap.w;
  float flare = smoothstep(stem - cap.z * 1.8, stem, p.y);
  float width = STEM * (1.0 + 1.1 * exp(-p.y / 3.0)) * sqrt(clamp((stem - p.y) / 5.0 + 0.1, 0.0, 1.0));
  float column = max(r - width - flare * cap.z * 0.45, p.y - stem);
  float edge = r / surge.x;
  float skirt = max(p.y - surge.y * (0.5 + 1.4 * exp(-r / 7.0)) * sqrt(max(1.0 - edge * edge, 0.0)), r - surge.x) * 0.7;
  return vec3(head, column, skirt);
}

float shape(vec3 p) {
  vec3 d = parts(p);
  return min(smin(d.x, d.y, 3.0), d.z);
}

vec4 grainFor(vec3 p, float head, float zoom, vec3 shift) {
  vec3 lifted = vec3(p.x, p.y - fire.z * 2.4, p.z) * zoom + shift;
  vec3 riding = vec3(p.x, p.y - cap.y, p.z) / (0.55 + (cap.x + cap.z) * 0.018) * zoom + shift + vec3(13.0, 13.0 + fire.z * 0.3, 13.0);
  if (head < 0.01) return grainAt(lifted);
  if (head > 0.99) return grainAt(riding);
  return mix(grainAt(lifted), grainAt(riding), head);
}

float density(vec3 p, bool fine, out float heat, out float head) {
  vec3 d = parts(p);
  float whole = min(smin(d.x, d.y, 3.0), d.z);
  head = smoothstep(-1.5, 1.5, min(d.y, d.z) - d.x);
  float dust = smoothstep(-1.0, 1.0, min(d.x, d.y) - d.z);
  vec4 n = grainFor(p, head, 1.0, vec3(0.0));
  float rough = mix(mix(2.0, 3.2, dust), min(cap.z * 0.5, 5.5) * smoothstep(0.0, 0.5, fire.z) + 0.6, head);
  float inside = rough * (n.r * 0.75 + n.g * 0.25 - 0.44) * 2.0 + (n.b - 0.48) * 1.4 - whole;
  if (fine) inside += (grainFor(p, head, 3.1, vec3(7.1, 7.1 - fire.z * 0.4, 7.1)).g - 0.48) * 0.8;
  float body = clamp(inside / 0.9, 0.0, 1.0);
  body *= smoothstep(0.0, 2.5, p.y) * (1.0 - dust * (0.35 + 0.65 * smoothstep(0.55, 1.0, length(p.xz) / surge.x)));
  vec2 t = tubeOf(p);
  float core = exp(-dot(t, t) / (cap.z * cap.z) * 1.8);
  heat = fire.x * head * core * (0.35 + 1.1 * n.a) + fire.y;
  return body;
}

float dark(vec3 p) {
  if (shape(p) > 4.5) return 0.0;
  float heat;
  float head;
  return density(p, false, heat, head);
}

float phase(float mu, float g) {
  return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
}

vec3 blackbody(float heat) {
  heat = clamp(heat, 0.0, 1.0);
  vec3 tint = mix(vec3(1.0, 0.16, 0.02), vec3(1.0, 0.5, 0.12), smoothstep(0.1, 0.5, heat));
  tint = mix(tint, vec3(1.0, 0.9, 0.78), smoothstep(0.55, 1.0, heat));
  return tint * heat * heat * 9.0;
}

vec3 film(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 screen = (gl_FragCoord.xy - view.xy) / view.z;
  vec3 ro = vec3(0.0, EYE, DISTANCE);
  vec3 rd = normalize(vec3(screen, -DISTANCE));

  float spread = max(cap.x + cap.z + 9.0, surge.x + 2.0);
  float top = cap.y + cap.z + 7.0;
  float far = DISTANCE + spread;
  if (rd.y < 0.0) far = min(far, EYE / -rd.y);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float s = DISTANCE - spread + 0.4 * jitter;

  float scatter = mix(phase(dot(rd, SUN), 0.6), phase(dot(rd, SUN), -0.3), 0.45);
  vec3 sun = mix(vec3(0.5, 0.47, 0.45), vec3(2.3, 2.15, 1.95), day);
  vec3 sky = mix(vec3(0.06, 0.06, 0.07), vec3(0.5, 0.52, 0.56), day);
  vec3 bounce = mix(vec3(0.03, 0.025, 0.02), vec3(0.24, 0.2, 0.16), day);
  vec3 smoke = mix(vec3(0.07, 0.055, 0.045), vec3(0.18, 0.11, 0.075), smoothstep(0.4, 2.0, fire.z));
  smoke = mix(smoke, vec3(0.42, 0.38, 0.34), smoothstep(1.2, 7.0, fire.z));
  vec3 earth = vec3(0.3, 0.24, 0.18);
  vec3 center = vec3(0.0, cap.y, 0.0);

  vec3 light = vec3(0.0);
  float clear = 1.0;
  for (int i = 0; i < 140; i++) {
    if (s > far || clear < 0.015) break;
    vec3 p = ro + rd * s;
    if (p.y > top || abs(p.x) > spread) {
      s += 1.0;
      continue;
    }
    float d = shape(p);
    if (d > 4.5) {
      s += max(d - 4.0, 0.5);
      continue;
    }
    float heat;
    float head;
    float body = density(p, true, heat, head);
    if (body > 0.002) {
      float depth = 0.0;
      float along = 0.0;
      for (int k = 0; k < 5; k++) {
        float hop = 0.5 + float(k) * 0.9;
        along += hop;
        depth += dark(p + SUN * along) * hop;
      }
      float lit = exp(-depth * 1.1) + 0.35 * exp(-depth * 0.3) + 0.12 * exp(-depth * 0.08);
      float powder = 1.0 - 0.6 * exp(-body * 3.0);
      float above = dark(p + vec3(0.0, 1.6, 0.0)) * 1.6 + dark(p + vec3(0.0, 4.5, 0.0)) * 3.0;
      vec3 lamp = fire.x * fire.x * vec3(3.0, 1.1, 0.25) * exp(-length(p - center) / (cap.z * 0.6 + 1.5));
      vec3 color = mix(earth, smoke, head) * (sun * lit * scatter * powder + sky * exp(-above * 0.45) + bounce + lamp);
      color += blackbody(heat);
      float taken = 1.0 - exp(-mix(1.5, 0.55, clamp(heat, 0.0, 1.0)) * body * 0.4);
      light += clear * taken * color;
      clear *= 1.0 - taken;
    }
    s += 0.4;
  }

  float alpha = 1.0 - clear;
  vec3 color = alpha > 0.0 ? light / alpha : vec3(0.0);
  color = pow(film(color * 0.9), vec3(1.0 / 2.2));

  vec2 off = screen - vec2(0.0, cap.y - EYE);
  float halo = (fire.x * fire.x * 0.5 + fire.y * 1.2) * exp(-length(off) / (cap.z * 1.3 + 3.0));
  vec3 bloom = min(vec3(1.0, 0.62, 0.32) * halo * 1.6, vec3(1.0));

  vec3 outColor = color * alpha + bloom * (1.0 - alpha);
  float outAlpha = alpha + max(bloom.r, max(bloom.g, bloom.b)) * (1.0 - alpha);
  float dither = (jitter - 0.5) / 255.0;
  pixel = clamp(vec4(outColor + dither, outAlpha + dither), 0.0, 1.0);
}
`

function compile(gl) {
  const program = gl.createProgram()
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ]) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}

const cells = (count) => ({ count, points: Float32Array.from({ length: count ** 3 * 3 }, Math.random) })

function nearest({ count, points }, x, y, z) {
  const scale = count / SIZE
  const [px, py, pz] = [(x + 0.5) * scale, (y + 0.5) * scale, (z + 0.5) * scale]
  const [cx, cy, cz] = [Math.floor(px), Math.floor(py), Math.floor(pz)]
  let best = 3
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [gx, gy, gz] = [cx + dx, cy + dy, cz + dz]
        const at = ((((gz + count) % count) * count + ((gy + count) % count)) * count + ((gx + count) % count)) * 3
        const [ox, oy, oz] = [gx + points[at] - px, gy + points[at + 1] - py, gz + points[at + 2] - pz]
        best = Math.min(best, ox * ox + oy * oy + oz * oz)
      }
    }
  }
  return Math.sqrt(best)
}

function billows() {
  const layers = CELLS.map(cells)
  const volume = new Uint8Array(SIZE ** 3 * 4)
  let z = 0
  return (until) => {
    for (; z < SIZE && performance.now() < until; z++) {
      let at = z * SIZE * SIZE * 4
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          for (const layer of layers) volume[at++] = 255 * (1 - Math.min(1, nearest(layer, x, y, z)))
        }
      }
    }
    return z === SIZE ? volume : null
  }
}

export function mushroomCloud(canvas, { detonateAt }) {
  const gl = canvas?.getContext('webgl2', { antialias: false, depth: false, powerPreference: 'high-performance' })
  if (!gl) return
  const program = compile(gl)
  if (!program) return
  gl.useProgram(program)

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const corner = gl.getAttribLocation(program, 'corner')
  gl.enableVertexAttribArray(corner)
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)

  const slot = Object.fromEntries(
    ['view', 'cap', 'stem', 'surge', 'fire', 'day'].map((name) => [name, gl.getUniformLocation(program, name)]),
  )

  const build = billows()
  let ready = false
  function upload(volume) {
    gl.bindTexture(gl.TEXTURE_3D, gl.createTexture())
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, SIZE, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, volume)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(gl.TEXTURE_3D, wrap, gl.REPEAT)
    }
    ready = true
  }

  let width = 0
  let height = 0
  let scale = 1
  let day = document.documentElement.dataset.theme === 'light' ? 1 : 0
  let last = 0
  let pace = 16
  let settled = 0

  function frame(now) {
    if (!canvas.isConnected) {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      return
    }
    requestAnimationFrame(frame)

    const t = (now - detonateAt) / 1000
    if (!ready) {
      const volume = build(t < 0 ? now + 6 : Infinity)
      if (volume) upload(volume)
    }
    if (t < 0) return

    if (t > 0.3 && last) {
      pace = pace * 0.8 + (now - last) * 0.2
      if (++settled > 6 && pace > 40 && scale > 0.3) {
        scale = Math.max(0.3, scale * Math.sqrt(25 / pace))
        pace = 16
        settled = 0
      }
    }
    last = now

    const cssWidth = canvas.clientWidth
    const cssHeight = canvas.clientHeight
    const budget = Math.min(PIXELS, cssWidth * cssHeight * (window.devicePixelRatio || 1) ** 2)
    const fit = Math.sqrt(budget / (cssWidth * cssHeight)) * scale
    if (Math.round(cssWidth * fit) !== width || Math.round(cssHeight * fit) !== height) {
      width = canvas.width = Math.round(cssWidth * fit)
      height = canvas.height = Math.round(cssHeight * fit)
      gl.viewport(0, 0, width, height)
    }

    const u = unit(width, height)
    const top = rise(t)
    const thick = tube(t)
    const squat = flat(t)
    day += ((document.documentElement.dataset.theme === 'light' ? 1 : 0) - day) * 0.08

    gl.uniform3f(slot.view, width / 2, height * (1 - GROUND) + EYE * u, u)
    gl.uniform4f(slot.cap, ring(t), top, thick, squat)
    gl.uniform1f(slot.stem, (top - thick * squat * 0.4) * clamp((t - 0.35) / 2.4) ** 0.6)
    gl.uniform2f(slot.surge, 4 + 32 * (1 - Math.exp(-t / 1.6)) + t, 1.5 + 3 * clamp(t / 1.5))
    gl.uniform3f(slot.fire, Math.exp(-t / 2), Math.exp(-t / 0.18), t)
    gl.uniform1f(slot.day, day)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  requestAnimationFrame(frame)
}
