import "./polyfills"; // must be first — polyfills Buffer for the Deepgram SDK
import "./style.css";
import "./style2.css";
import { VoiceAgent, AgentStatus, ConversationEntry } from "./voiceAgent";
import { setupFaceCanvas } from "./service/face/expressions";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;
const micIcon = document.getElementById("mic-icon") as unknown as SVGElement;
const stopIcon = document.getElementById("stop-icon") as unknown as SVGElement;
const statusBadge = document.getElementById("status-badge") as HTMLDivElement;
const statusLabel = document.getElementById("status-label") as HTMLSpanElement;
const statusMessage = document.getElementById(
  "status-message",
) as HTMLParagraphElement;
const errorBanner = document.getElementById("error-banner") as HTMLDivElement;
const errorMessage = document.getElementById(
  "error-message",
) as HTMLSpanElement;
const transcriptWrapper = document.getElementById(
  "transcript-wrapper",
) as HTMLDivElement;
const transcript = document.getElementById("transcript") as HTMLDivElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const visualizer = document.getElementById("visualizer") as HTMLDivElement;

// ── State ─────────────────────────────────────────────────────────────────────
let agent: VoiceAgent | null = null;
let isActive = false;

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AgentStatus,
  {
    label: string;
    message: string;
    badgeClass: string;
    visualizerClass: string;
  }
> = {
  idle: {
    label: "Ready",
    message: "Click to start a voice conversation",
    badgeClass: "status-idle",
    visualizerClass: "",
  },
  connecting: {
    label: "Connecting…",
    message: "Connecting to Cookie…",
    badgeClass: "status-connecting",
    visualizerClass: "connecting",
  },
  connected: {
    label: "Connected",
    message: "Connected — configuring agent…",
    badgeClass: "status-connected",
    visualizerClass: "active",
  },
  listening: {
    label: "Listening",
    message: "Go ahead, I'm listening…",
    badgeClass: "status-listening",
    visualizerClass: "listening",
  },
  "agent-thinking": {
    label: "Thinking…",
    message: "Cookie is thinking…",
    badgeClass: "status-thinking",
    visualizerClass: "thinking",
  },
  "agent-speaking": {
    label: "Speaking",
    message: "Cookie is speaking…",
    badgeClass: "status-speaking",
    visualizerClass: "speaking",
  },
  error: {
    label: "Error",
    message: "Something went wrong.",
    badgeClass: "status-error",
    visualizerClass: "",
  },
  disconnected: {
    label: "Disconnected",
    message: "Session ended. Click to start again.",
    badgeClass: "status-idle",
    visualizerClass: "",
  },
};

function applyStatus(status: AgentStatus): void {
  const config = STATUS_CONFIG[status];

  // Badge
  statusBadge.className = `status-badge ${config.badgeClass}`;
  statusLabel.textContent = config.label;

  // Message
  statusMessage.textContent = config.message;

  // Visualizer animation class
  visualizer.className = `visualizer${config.visualizerClass ? " " + config.visualizerClass : ""}`;

  // Toggle button icons
  const running =
    status !== "idle" && status !== "error" && status !== "disconnected";

  micIcon.style.display = running ? "none" : "";
  stopIcon.style.display = running ? "" : "none";

  toggleBtn.disabled = status === "connecting";
}

function showError(msg: string): void {
  errorBanner.style.display = "flex";
  errorMessage.textContent = msg;
}

function clearError(): void {
  errorBanner.style.display = "none";
  errorMessage.textContent = "";
}

// ── Conversation transcript ────────────────────────────────────────────────────
function appendTranscriptEntry(entry: ConversationEntry): void {
  transcriptWrapper.style.display = "block";

  const row = document.createElement("div");
  row.className = `transcript-row ${entry.role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = entry.content;

  const time = document.createElement("span");
  time.className = "bubble-time";
  time.textContent = entry.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  row.appendChild(bubble);
  row.appendChild(time);
  transcript.appendChild(row);

  // Scroll to bottom
  transcript.scrollTop = transcript.scrollHeight;
}

// ── Start / stop ───────────────────────────────────────────────────────────────

/**
 * Fetches a short-lived Deepgram access token from the cookie-api backend.
 * The token is generated via deepgram.auth.grantToken() and must be passed
 * to createClient() as { accessToken } (Bearer scheme) — NOT as a plain string
 * (which the SDK treats as a raw API key and sends with the wrong auth scheme).
 */
async function fetchAccessToken(): Promise<string> {
  console.log("[auth] Fetching token from /api/chat-token");
  const vite_api_url = process.env.VITE_API_URL + " -wtf";
  console.log("VITE_API_URL:", vite_api_url);
  let res: Response;
  try {
    res = await fetch(
      `${process.env.VITE_API_URL || "http://localhost:3000"}/api/chat-token`,
    );
  } catch {
    throw new Error(
      `Cannot reach the API server at ${process.env.VITE_API_URL || "http://localhost:3000"}. Make sure cookie-api is running.`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Token endpoint returned ${res.status}: ${body || res.statusText}`,
    );
  }

  const json = await res.json();
  if (!json.token) throw new Error("Token endpoint returned no token field");

  console.log("[auth] Got grantToken access token");
  return json.token as string;
}

async function startConversation(): Promise<void> {
  clearError();
  isActive = true;
  applyStatus("connecting");

  try {
    const token = await fetchAccessToken();

    agent = new VoiceAgent({
      onStatusChange: (status) => {
        applyStatus(status);
        if (status === "disconnected" || status === "error") {
          isActive = false;
        }
      },
      onConversationText: appendTranscriptEntry,
      onError: showError,
    });

    await agent.start(token);
  } catch (err) {
    isActive = false;
    applyStatus("error");
    showError(
      err instanceof Error ? err.message : "Failed to start conversation",
    );
    agent = null;
  }
}

function stopConversation(): void {
  agent?.disconnect();
  agent = null;
  isActive = false;
  applyStatus("idle");
}

// ── Event listeners ───────────────────────────────────────────────────────────
toggleBtn.addEventListener("click", () => {
  if (isActive) {
    stopConversation();
  } else {
    startConversation();
  }
});

clearBtn.addEventListener("click", () => {
  transcript.innerHTML = "";
  transcriptWrapper.style.display = "none";
});

// Initial state
setupFaceCanvas(document.getElementById("robot-face") as HTMLCanvasElement);
applyStatus("idle");
