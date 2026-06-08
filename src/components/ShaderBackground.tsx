import { useEffect, useRef } from 'react';

/*
  Renderiza el shader Perlin/FBM como background fullscreen.
  - El vertex shader es un fullscreen quad (2 triángulos cubriendo NDC -1..1).
  - El fragment shader es el que pasó el usuario, con uniforms u_resolution
    y u_time.
  - Loop con requestAnimationFrame. Se pausa cuando el tab está oculto.
*/

const VERTEX_SRC = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SRC = `
  precision mediump float;

  uniform vec2 u_resolution;
  uniform float u_time;
  /* u_seed: número arbitrario por instancia (típicamente 0..1).
     Lo usamos para desplazar la región de noise y la fase de tiempo,
     de modo que dos shaders con seeds distintos no se vean idénticos. */
  uniform float u_seed;

  const vec3 BG  = vec3(0.0, 0.0, 0.0);
  const vec3 RED = vec3(0.4, 0.0, 0.0);

  vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

  vec2 fade(vec2 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  float perlin(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, 289.0);
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;
    vec4 i  = permute(permute(ix) + iy);
    vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
      vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11));
    g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));
    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
  }

  float pnoise(vec2 p) {
    return perlin(p) * 0.5 + 0.5;
  }

  float fbm(vec2 p) {
    return pnoise(p)       * 0.500
         + pnoise(p * 2.0) * 0.250
         + pnoise(p * 4.0) * 0.125
         + pnoise(p * 8.0) * 0.0625;
  }

  void main() {
    vec2 fragUv = gl_FragCoord.xy / u_resolution.xy;
    vec2 uv = fragUv;
    uv.x *= u_resolution.x / u_resolution.y;
    float t = u_time * 0.07;

    /* Offset por seed: los 47.1 y 31.7 son números arbitrarios (primos
       para evitar repeticiones obvias). Cada instancia ve una región
       distinta del noise infinito, y arranca con una fase de tiempo
       distinta (u_seed * 100 corre el clock muchos "segundos" hacia adelante). */
    uv += vec2(u_seed * 47.1, u_seed * 31.7);
    t += u_seed * 100.0;

    vec2 wuv = uv;

    vec2 q = vec2(
      fbm(wuv + vec2(0.00, 0.00) + t),
      fbm(wuv + vec2(5.20, 1.30) + t * 0.9)
      );
      
      vec2 r = vec2(
        fbm(wuv + 2.8 * q + vec2(1.70, 9.20) + t * 0.7),
      fbm(wuv + 2.8 * q + vec2(8.30, 2.80) + t * 0.5)
      );
      
    float f = fbm(wuv + 2.8 * r);
    
    /* Solo rojo sobre negro puro. El campo de noise (f) y el warp (q.x)
       definen dónde "fluye" el rojo. */
    float redAmt = smoothstep(0.20, 0.55, f) * 0.75
                 + smoothstep(0.25, 0.48, q.x) * 0.40;

    vec3 color = mix(BG, RED, redAmt);

    color *= 0.40;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Props = {
  /* Valor arbitrario (típico 0..1) que desplaza la región del noise y la
     fase del tiempo. Útil para que múltiples instancias del shader en la
     misma página no se vean idénticas. */
  seed?: number;
};

export default function ShaderBackground({ seed = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) {
      console.warn('WebGL no disponible');
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    /* Fullscreen quad: 2 triángulos en NDC */
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const seedLoc = gl.getUniformLocation(program, 'u_seed');
    /* El seed no cambia con el tiempo, lo seteamos una vez. */
    gl.uniform1f(seedLoc, seed);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    let raf = 0;
    let running = true;

    const render = (now: number) => {
      if (!running) return;
      resize();
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    /* Pausa cuando el tab está oculto: ahorra CPU/GPU. */
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [seed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
