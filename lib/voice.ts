"use client";

type VoiceConfig = {
  useElevenLabs?: boolean;
};

class VoiceEngine {
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  constructor(private config: VoiceConfig = {}) {}

  supportsNativeRecognition() {
    return (
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition)
    );
  }

  async speak(text: string) {
    if (this.config.useElevenLabs) {
      await fetch("/api/voice/tts", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      return;
    }

    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  async startListening(onResult: (text: string) => void) {
    if (this.supportsNativeRecognition()) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      this.recognition = new SpeechRecognition();
      this.recognition.lang = "en-US";
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      this.recognition.start();
      return;
    }

    // Fallback to MediaRecorder + Whisper
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = async () => {
      const blob = new Blob(this.audioChunks, { type: "audio/webm" });

      const form = new FormData();
      form.append("file", blob);

      const r = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });

      const data = await r.json();
      onResult(data.text);
    };

    this.mediaRecorder.start();
  }

  stopListening() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

export const voice = new VoiceEngine({
  useElevenLabs: false, // set true to enable premium TTS
});