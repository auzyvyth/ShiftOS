// Background cut-out on the processor (WebAssembly). Used on devices without
// WebGPU, and after the GPU path has failed once on a device. See cutout.core.js.
import { InferenceSession, Tensor, env } from 'onnxruntime-web/wasm';
import { serveCutout } from './cutout.core.js';

serveCutout({ InferenceSession, Tensor, env }, ['wasm']);
