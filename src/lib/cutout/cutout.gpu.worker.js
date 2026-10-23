// Background cut-out on the graphics chip (WebGPU). Its engine is about twice
// the size of the processor one, so only devices that report a GPU adapter
// load this worker. See cutout.core.js.
import { InferenceSession, Tensor, env } from 'onnxruntime-web/webgpu';
import { serveCutout } from './cutout.core.js';

serveCutout({ InferenceSession, Tensor, env }, ['webgpu']);
