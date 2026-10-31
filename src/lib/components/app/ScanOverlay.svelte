<script lang="ts">
  import { onMount } from 'svelte';
  import type { ScanMap } from '$lib/image/segment';

  /**
   * Plays once over a freshly scanned page: a light sweeps down the page and every area it
   * passes lights up in its own color with a glowing halo along its outline, then fades away.
   * Runs on the GPU; without WebGL or with reduced motion it ends right away.
   */
  let { map, onend }: { map: ScanMap; onend: () => void } = $props();

  let canvas = $state<HTMLCanvasElement>();

  /** Seconds: start delay, sweep from top to bottom, then hold and fade. */
  const DELAY = 0.15;
  const SWEEP = 1.2;
  const END = DELAY + SWEEP + 1.1;

  const VERTEX = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  const FRAGMENT = `
    precision mediump float;
    uniform sampler2D u_map;
    uniform float u_t;
    varying vec2 v_uv;

    vec3 hue(float h) {
      vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return mix(vec3(1.0), k, 0.75);
    }

    void main() {
      vec4 m = texture2D(u_map, v_uv);
      float fade = 1.0 - smoothstep(${(END - 0.55).toFixed(2)}, ${END.toFixed(2)}, u_t);
      float sweepPos = (u_t - ${DELAY.toFixed(2)}) / ${SWEEP.toFixed(2)};

      // The scan line: a soft violet band with a bright core
      float band = abs(v_uv.y - sweepPos);
      float sweep = (exp(-band * 260.0) * 0.85 + exp(-band * 30.0) * 0.16)
        * step(0.0, sweepPos) * (1.0 - smoothstep(0.92, 1.05, sweepPos));
      vec3 sweepColor = vec3(0.55, 0.36, 0.96);

      // Pixels light up as the scan line passes; each area pulses when the line reaches its center
      float ageP = u_t - (${DELAY.toFixed(2)} + v_uv.y * ${SWEEP.toFixed(2)});
      float ageR = u_t - (${DELAY.toFixed(2)} + m.r * ${SWEEP.toFixed(2)});
      float lit = smoothstep(0.0, 0.1, ageP) * step(0.004, m.a);
      float pulse = exp(-pow((ageR - 0.1) / 0.16, 2.0));
      float d = m.g * 255.0;
      float tint = lit * m.a * (0.08 + 0.3 * pulse);
      float halo = lit * (exp(-d / 3.5) * (0.7 + 0.3 * pulse) + exp(-d / 14.0) * 0.3 * pulse);
      vec3 c = hue(m.b);

      float a = clamp(tint + halo, 0.0, 0.95) * fade;
      vec3 rgb = c * a + mix(sweepColor, vec3(1.0), exp(-band * 600.0) * 0.6) * sweep * fade;
      gl_FragColor = vec4(rgb, clamp(a + sweep * fade, 0.0, 1.0));
    }`;

  onMount(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas?.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    if (reduce || !gl || !canvas) {
      onend();
      return;
    }
    canvas.width = map.width;
    canvas.height = map.height;

    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      onend();
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, map.width, map.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, map.data);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    const uT = gl.getUniformLocation(program, 'u_t');

    gl.viewport(0, 0, map.width, map.height);
    let start = 0;
    let frame = requestAnimationFrame(function draw(now) {
      start ||= now;
      const t = (now - start) / 1000;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (t < END) frame = requestAnimationFrame(draw);
      else onend();
    });

    return () => {
      cancelAnimationFrame(frame);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  });
</script>

<canvas bind:this={canvas} class="pointer-events-none absolute inset-0 size-full" aria-hidden="true"></canvas>
