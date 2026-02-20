declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function startListening(onCookieDetected: () => void) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error("Speech Recognition not supported");
  }

  const recognition = new SpeechRecognition();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase().trim();

      if (transcript.includes("cookie")) {
        onCookieDetected();
      }
    }
  };

  recognition.onerror = (e: any) => {
    console.error("Speech error:", e);
  };

  recognition.start();

  return recognition;
}
