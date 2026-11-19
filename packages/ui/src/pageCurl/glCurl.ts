import { type Corner, foldParams } from "./foldParams";
import { FRAGMENT_SOURCE, UNIFORM_NAMES, VERTEX_SOURCE } from "./shader";

export class GlCurlError extends Error {
  readonly stage: "context" | "compile" | "link" | "draw";

  constructor(stage: GlCurlError["stage"], message: string) {
    super(message);
    this.name = "GlCurlError";
    this.stage = stage;
  }
}

export type Rgb = [number, number, number];

export type GlCurl = {
  begin(
    front: HTMLCanvasElement,
    under: HTMLCanvasElement,
    paper: Rgb,
    bw: number,
    bh: number,
  ): void;
  fold(corner: Corner, px: number, py: number, bw: number, bh: number): void;
  end(): void;
  dispose(): void;
};

type Uniforms = Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new GlCurlError("compile", "createShader returned null");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new GlCurlError("compile", gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function createTexture(gl: WebGLRenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new GlCurlError("context", "createTexture returned null");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function createGlCurl(canvas: HTMLCanvasElement): GlCurl {
  const context =
    canvas.getContext("webgl", { alpha: false, antialias: false }) ??
    (canvas.getContext("experimental-webgl", { alpha: false }) as WebGLRenderingContext | null);
  if (!context) throw new GlCurlError("context", "WebGL is not available");
  const gl: WebGLRenderingContext = context;

  const program = gl.createProgram();
  if (!program) throw new GlCurlError("link", "createProgram returned null");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new GlCurlError("link", gl.getProgramInfoLog(program) ?? "program link failed");
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {} as Uniforms;
  for (const name of UNIFORM_NAMES) uniforms[name] = gl.getUniformLocation(program, name);
  const textures = [createTexture(gl), createTexture(gl)] as const;
  gl.uniform1i(uniforms.uFront, 0);
  gl.uniform1i(uniforms.uUnder, 1);

  function upload(unit: 0 | 1, source: HTMLCanvasElement): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, textures[unit]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  return {
    begin(front, under, paper, bw, bh) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      upload(0, front);
      upload(1, under);
      canvas.width = Math.round(bw * dpr);
      canvas.height = Math.round(bh * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(uniforms.uPaper, paper[0], paper[1], paper[2]);
      canvas.style.display = "block";
    },
    fold(corner, px, py, bw, bh) {
      const p = foldParams(corner, px, py, bw, bh);
      gl.uniform2f(uniforms.uSize, bw, bh);
      gl.uniform2f(uniforms.uC, p.cx, p.cy);
      gl.uniform2f(uniforms.uU, p.ux, p.uy);
      gl.uniform1f(uniforms.uA, p.a);
      gl.uniform1f(uniforms.uR, p.R);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (gl.getError() !== gl.NO_ERROR) throw new GlCurlError("draw", "WebGL draw error");
    },
    end() {
      canvas.style.display = "none";
    },
    dispose() {
      canvas.style.display = "none";
      gl.deleteTexture(textures[0]);
      gl.deleteTexture(textures[1]);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
