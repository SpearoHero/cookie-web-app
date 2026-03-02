// Polyfill Node.js globals that the Deepgram SDK references in its browser bundle.
// This file must be imported before any SDK code runs.
import { Buffer } from "buffer";

(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
