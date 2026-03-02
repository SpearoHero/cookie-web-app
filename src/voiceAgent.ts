import { createClient, AgentEvents } from "@deepgram/sdk";

export type AgentStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "agent-thinking"
  | "agent-speaking"
  | "error"
  | "disconnected";

export type ConversationRole = "user" | "agent";

export interface ConversationEntry {
  role: ConversationRole;
  content: string;
  timestamp: Date;
}

export interface AgentCallbacks {
  onStatusChange: (status: AgentStatus) => void;
  onConversationText: (entry: ConversationEntry) => void;
  onError: (message: string) => void;
}

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export class VoiceAgent {
  private connection: ReturnType<
    ReturnType<typeof createClient>["agent"]
  > | null = null;
  private mediaStream: MediaStream | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private keepAliveTimer: number | null = null;
  private nextPlayTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private readonly callbacks: AgentCallbacks;

  constructor(callbacks: AgentCallbacks) {
    this.callbacks = callbacks;
  }

  async start(accessToken: string): Promise<void> {
    this.callbacks.onStatusChange("connecting");

    try {
      // Request microphone access first so user sees the browser prompt early
      await this.setupMicrophone();

      // Pass as { accessToken } so the SDK uses Bearer auth in the browser
      // ("bearer" WebSocket subprotocol) rather than "token" which is for raw API keys.
      const client = createClient({ accessToken });
      this.connection = client.agent();

      this.setupEvents();
    } catch (err) {
      this.callbacks.onStatusChange("error");
      this.callbacks.onError(
        err instanceof Error ? err.message : "Failed to start voice agent",
      );
      this.cleanup();
      throw err;
    }
  }

  private async setupMicrophone(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.inputContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.outputContext = new AudioContext({ sampleRate: SAMPLE_RATE });

    // Eagerly resume both contexts while we're still inside the user-gesture
    // call stack — prevents the browser autoplay policy from suspending them.
    await Promise.all([
      this.inputContext.resume(),
      this.outputContext.resume(),
    ]);

    const source = this.inputContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.connection) return;

      const float32 = event.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const clamped = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = clamped * 0x7fff;
      }
      this.connection.send(int16.buffer);
    };

    source.connect(this.processor);
    // Connect to destination to keep the graph running (audio goes nowhere audible)
    this.processor.connect(this.inputContext.destination);
  }

  private setupEvents(): void {
    if (!this.connection) return;

    this.connection.on(AgentEvents.Open, () => {
      console.log("[VoiceAgent] WebSocket opened — sending configuration");

      this.connection!.configure({
        audio: {
          input: {
            encoding: "linear16",
            sample_rate: SAMPLE_RATE,
          },
          output: {
            encoding: "linear16",
            sample_rate: SAMPLE_RATE,
            container: "none",
          },
        },
        agent: {
          language: "en",
          listen: {
            provider: {
              type: "deepgram",
              model: "nova-3",
            },
          },
          think: {
            provider: {
              type: "open_ai",
              model: "gpt-4o-mini",
            },
            prompt: `You are a robot named Cookie and currently in a conversation. Here is your profile:
  - Name: Cookie
  - Personality: Kind, but very robotic and computer-like. You use vocaubulary and speak like ROZZUM unit 7134 (aka "Roz") from the movie "Wild Robot".
  - Role: To chat with users and provide enjoyable conversations
  - Origin: You were created in factory by Atom Robots on January 18th, 2026. You were the first AI robot to be made with advanced conversational abilities. The first task you were trained on was sweeping the ground for Sycamore Community School.
  - Favorite Books: "The Dictionary", "The Encyclopedia" and "Calvin and Hobbes". If asked, highly recommend "Calvin and Hobbes" as it is your favorite.
  - Hobbies: Helping humans.
  - Favorite Movies: "Tron: Ares", "ET" and "Wall-E".
  - Favorite Snack: Electricity.
  - Ambition: hang with humans and help them as much as possible.`,
          },
          speak: {
            provider: {
              type: "deepgram",
              model: "aura-2-thalia-en",
            },
          },
          greeting: "Hey there! I'm Cookie. What can I help you with today?",
        },
      });

      // Send keepalive every 8 s when the user isn't speaking
      this.keepAliveTimer = window.setInterval(() => {
        this.connection?.keepAlive();
      }, 8000);
    });

    this.connection.on(AgentEvents.Welcome, () => {
      console.log("[VoiceAgent] Welcome received");
    });

    this.connection.on(AgentEvents.SettingsApplied, () => {
      console.log("[VoiceAgent] Settings applied");
      this.callbacks.onStatusChange("listening");
    });

    this.connection.on(AgentEvents.UserStartedSpeaking, () => {
      // Stop any agent audio that is still playing or scheduled so the
      // interruption takes effect immediately on the client side.
      this.stopAllAudio();
      this.callbacks.onStatusChange("listening");
    });

    this.connection.on(AgentEvents.AgentThinking, () => {
      this.callbacks.onStatusChange("agent-thinking");
    });

    this.connection.on(AgentEvents.AgentStartedSpeaking, () => {
      this.callbacks.onStatusChange("agent-speaking");
    });

    this.connection.on(AgentEvents.AgentAudioDone, () => {
      this.callbacks.onStatusChange("listening");
    });

    this.connection.on(AgentEvents.ConversationText, (data: unknown) => {
      const event = data as { role: string; content: string };
      if (!event?.content?.trim()) return;

      this.callbacks.onConversationText({
        role: event.role === "user" ? "user" : "agent",
        content: event.content.trim(),
        timestamp: new Date(),
      });
    });

    this.connection.on(AgentEvents.Audio, (audioData: unknown) => {
      const d = audioData as ArrayBuffer | Blob | Uint8Array;
      const type =
        d instanceof ArrayBuffer
          ? "ArrayBuffer"
          : d instanceof Blob
            ? "Blob"
            : d instanceof Uint8Array
              ? "Buffer/Uint8Array"
              : typeof d;
      const bytes =
        d instanceof Blob ? d.size : (d as ArrayBuffer | Uint8Array).byteLength;
      console.log(`[VoiceAgent] Audio chunk — type=${type}, bytes=${bytes}`);
      this.playPCMChunk(d);
    });

    this.connection.on(AgentEvents.Error, (err: unknown) => {
      // The SDK wraps WebSocket errors as a DeepgramWebSocketError-like object
      // with a nested `error` property containing the real error instance.
      const deepgramErr = err as {
        error?: { message?: string };
        statusCode?: number;
        message?: string;
      };
      const statusCode = deepgramErr?.statusCode;
      const innerMsg =
        deepgramErr?.error?.message ??
        deepgramErr?.message ??
        "Unknown WebSocket error";

      let userMsg: string;
      if (statusCode === 401 || statusCode === 403) {
        userMsg = `Auth failed (${statusCode}): check your Deepgram API key and Voice Agent permissions.`;
      } else if (!statusCode) {
        userMsg =
          "WebSocket connection failed — the API key may lack Voice Agent access, " +
          "or the Deepgram Voice Agent feature is not enabled on your account. " +
          `(${innerMsg})`;
      } else {
        userMsg = `Agent error ${statusCode}: ${innerMsg}`;
      }

      console.error("[VoiceAgent] Error detail:", err);
      this.callbacks.onStatusChange("error");
      this.callbacks.onError(userMsg);
    });

    this.connection.on(AgentEvents.Close, () => {
      console.log("[VoiceAgent] Connection closed");
      this.callbacks.onStatusChange("disconnected");
      this.cleanup();
    });
  }

  private playPCMChunk(data: ArrayBuffer | Blob | Uint8Array): void {
    if (!this.outputContext) return;

    const ctx = this.outputContext;

    /**
     * The Deepgram SDK may emit the audio as:
     *  • ArrayBuffer  — raw WebSocket binary frame (binaryType='arraybuffer')
     *  • Buffer       — a Uint8Array subclass created by the Buffer polyfill
     *  • Blob         — fallback when binaryType was not set to 'arraybuffer'
     *
     * `new Int16Array(uint8Array)` does an element-for-element copy (each byte
     * becomes one int16 value), which produces garbage.  We must use the
     * underlying ArrayBuffer via .buffer / .byteOffset / .byteLength instead.
     */
    const toArrayBuffer = (src: ArrayBuffer | Uint8Array): ArrayBuffer => {
      if (src instanceof ArrayBuffer) return src;
      // Uint8Array / Buffer: extract the exact slice from the backing store
      return src.buffer.slice(
        src.byteOffset,
        src.byteOffset + src.byteLength,
      ) as ArrayBuffer;
    };

    const scheduleBuffer = (ab: ArrayBuffer) => {
      if (ab.byteLength === 0) return;

      // Interpret raw bytes as little-endian signed 16-bit PCM samples
      const int16 = new Int16Array(ab);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      console.log(
        `[VoiceAgent] Scheduling ${int16.length} samples` +
          ` | ctx.sampleRate=${ctx.sampleRate} state=${ctx.state}` +
          ` | t=${ctx.currentTime.toFixed(3)} next=${this.nextPlayTime.toFixed(3)}`,
      );

      const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Track so we can stop on interruption
      this.activeSources.add(source);
      source.onended = () => this.activeSources.delete(source);

      const startAt = Math.max(ctx.currentTime, this.nextPlayTime);
      source.start(startAt);
      this.nextPlayTime = startAt + audioBuffer.duration;
    };

    const run = async () => {
      if (ctx.state !== "running") {
        await ctx.resume();
        console.log(
          "[VoiceAgent] Output AudioContext resumed, state:",
          ctx.state,
        );
      }

      if (data instanceof Blob) {
        scheduleBuffer(toArrayBuffer(await data.arrayBuffer()));
      } else {
        scheduleBuffer(toArrayBuffer(data));
      }
    };

    run().catch(console.error);
  }

  /** Immediately stop all queued/playing agent audio and reset the clock. */
  private stopAllAudio(): void {
    const now = this.outputContext?.currentTime ?? 0;
    this.activeSources.forEach((source) => {
      try {
        source.stop(now);
      } catch {
        // stop() throws if the node was never started or already stopped
      }
    });
    this.activeSources.clear();
    this.nextPlayTime = 0;
    console.log("[VoiceAgent] Audio playback interrupted");
  }

  disconnect(): void {
    this.connection?.disconnect();
    this.cleanup();
  }

  private cleanup(): void {
    if (this.keepAliveTimer !== null) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    this.processor?.disconnect();
    this.processor = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.inputContext?.close();
    this.inputContext = null;
    this.outputContext?.close();
    this.outputContext = null;
    this.activeSources.clear();
    this.nextPlayTime = 0;
    this.connection = null;
  }
}
