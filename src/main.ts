import "./style.css";
import { startListening } from "./service/listen";
import {
  drawEyesNormal,
  //drawEyesHappy
} from "./service/eyes/normal";

// Function to send text to the API and play the audio response
async function submitTextToSpeech(text: string) {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the raw binary audio data as a blob
    const audioBlob = await response.blob();

    // Create audio URL and play
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();

    // Clean up the URL when audio ends
    audio.onended = () => URL.revokeObjectURL(audioUrl);
  } catch (error) {
    console.error("Error:", error);
    alert(
      `Failed to process request: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Set up the UI
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="container">
    <canvas id="robot-face" width="800" height="400"></canvas>
    <div class="card">
      <textarea 
        id="textInput" 
        rows="3"
      ></textarea>
      <button id="submitBtn" type="button" style="display: none;">Submit</button>
      <div id="status"></div>
    </div>
  </div>
`;

// Set up the canvas grid
const canvas = document.querySelector<HTMLCanvasElement>("#robot-face")!;
const ctx = canvas.getContext("2d")!;

// Set black background
ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);

const leftEyeX = 25;
const leftEyeY = 35;
const leftEyeRadius = 22;
drawEyesNormal(ctx, canvas, leftEyeX, leftEyeY, leftEyeRadius);
//drawEyesHappy(ctx, canvas, leftEyeX, leftEyeY, leftEyeRadius);

const rightEyeX = 87;
const rightEyeY = 35;
const rightEyeRadius = 22;
drawEyesNormal(ctx, canvas, rightEyeX, rightEyeY, rightEyeRadius);
//drawEyesHappy(ctx, canvas, rightEyeX, rightEyeY, rightEyeRadius);
// Restore canvas transformation
ctx.restore();

// Add event listener for submit button
const submitBtn = document.querySelector<HTMLButtonElement>("#submitBtn")!;
const textInput = document.querySelector<HTMLTextAreaElement>("#textInput")!;
const status = document.querySelector<HTMLDivElement>("#status")!;

let silenceTimer: number | null = null;
let hasReceivedText = false;
let isListeningMode = false;

const recognition = startListening(() => {
  console.log("COOKIE!");
});

// Add speech recognition result handler
recognition.onresult = (event: any) => {
  // First check for "cookie" trigger
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript.toLowerCase().trim();

    if (transcript.includes("cookie")) {
      isListeningMode = true;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawEyesNormal(
        ctx,
        canvas,
        leftEyeX,
        leftEyeY,
        leftEyeRadius,
        "listening",
      );
      drawEyesNormal(
        ctx,
        canvas,
        rightEyeX,
        rightEyeY,
        rightEyeRadius,
        "listening",
      );

      // Don't process this result, wait for the next ones
      return;
    }
  }

  // Only process text if we're in listening mode (after "cookie" was detected)
  if (!isListeningMode) {
    return;
  }

  let finalTranscript = "";

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;

    if (event.results[i].isFinal) {
      finalTranscript += transcript + " ";
    }
  }

  if (finalTranscript) {
    hasReceivedText = true;
    textInput.value += finalTranscript;

    // Clear existing timer
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }

    // Set new timer for 1 second of silence
    silenceTimer = window.setTimeout(() => {
      if (hasReceivedText && textInput.value.trim()) {
        // Submit the form
        submitBtn.click();
      }
      recognition.stop();
      hasReceivedText = false;
      isListeningMode = false;
    }, 1000);
  }
};

submitBtn.addEventListener("click", async () => {
  const text = textInput.value.trim();

  if (!text) {
    alert("Please enter some text");
    return;
  }

  submitBtn.disabled = true;
  status.textContent = "Processing...";

  await submitTextToSpeech(text);

  submitBtn.disabled = false;
  status.textContent = "";
  textInput.value = "";
  recognition.start();
});
