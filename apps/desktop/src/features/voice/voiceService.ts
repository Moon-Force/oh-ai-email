import { useAiSettings } from "../ai/settingsStore";
import { aiSynthesizeSpeech, aiTranscribeAudio } from "../../lib/ipc";

// Web Speech API type definitions for SpeechRecognition
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

let activeAudioElement: HTMLAudioElement | null = null;

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return Boolean(
    win.SpeechRecognition ||
    win.webkitSpeechRecognition ||
    (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia)
  );
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as { SpeechSynthesisUtterance?: unknown };
  return (
    typeof Audio !== "undefined" ||
    ("speechSynthesis" in window &&
      Boolean(win.SpeechSynthesisUtterance || typeof SpeechSynthesisUtterance !== "undefined"))
  );
}

/**
 * Starts speech-to-text recognition.
 * If configured with a custom STT endpoint and MediaRecorder is available, uses audio recording + STT API.
 * Otherwise seamlessly falls back to Web Speech API.
 */
export function startSpeechRecognition(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (err: string) => void,
  onEnd?: () => void
): () => void {
  const settings = useAiSettings.getState();
  const useCloudStt =
    settings.sttService === "custom" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  if (useCloudStt) {
    let mediaStream: MediaStream | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    const audioChunks: Blob[] = [];
    let isAborted = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (isAborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStream = stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (isAborted || audioChunks.length === 0) {
            onEnd?.();
            return;
          }

          const blob = new Blob(audioChunks, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
              const res = await aiTranscribeAudio({ audioData: base64, mimeType: "audio/webm" });
              if (res.ok && res.text) {
                onResult(res.text, true);
              } else if (!res.ok) {
                onError?.(res.error || "语音识别失败，请检查模型与服务配置");
              }
            } catch (err) {
              onError?.(err instanceof Error ? err.message : "语音识别请求超时或失败");
            } finally {
              onEnd?.();
            }
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorder.start();
      })
      .catch((err) => {
        // If microphone permission denied or MediaRecorder fails, fallback to Web Speech
        fallbackWebSpeech();
      });

    return () => {
      isAborted = true;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
      }
    };
  }

  function fallbackWebSpeech(): () => void {
    if (typeof window === "undefined") {
      onError?.("当前环境不支持语音识别");
      return () => {};
    }

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionClass) {
      onError?.("未找到可用语音识别引擎");
      return () => {};
    }

    let recognition: ISpeechRecognition | null = new RecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res && res[0]) {
          if (res.isFinal) {
            final += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }
      }

      const output = final || interim;
      if (output.trim()) {
        onResult(output.trim(), Boolean(final));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let msg = `语音识别错误: ${event.error}`;
      if (event.error === "not-allowed") {
        msg = "麦克风权限被拒绝，请在系统设置中允许麦克风权限";
      } else if (event.error === "no-speech") {
        msg = "未检测到语音输入";
      }
      onError?.(msg);
    };

    recognition.onend = () => {
      onEnd?.();
    };

    try {
      recognition.start();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "启动语音识别失败");
    }

    return () => {
      if (recognition) {
        try {
          recognition.stop();
          recognition.abort();
        } catch {
          // Ignore stop errors
        }
        recognition = null;
      }
    };
  }

  return fallbackWebSpeech();
}

/**
 * Speaks the given text aloud.
 * If configured with a custom TTS model, requests audio synthesis from the model and plays it.
 * Otherwise falls back to browser SpeechSynthesis.
 */
export function speakText(
  text: string,
  onEnd?: () => void,
  onError?: (err: string) => void
): () => void {
  // Clean HTML tags and markdown symbols for natural reading
  const cleanText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/[*#_`~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) {
    onEnd?.();
    return () => {};
  }

  stopSpeaking();

  const settings = useAiSettings.getState();
  const useCloudTts = settings.ttsService === "custom";

  if (useCloudTts) {
    let canceled = false;
    let audio: HTMLAudioElement | null = null;

    aiSynthesizeSpeech({ text: cleanText, voice: settings.ttsVoice })
      .then((res) => {
        if (canceled) return;
        if (res.ok && res.audioData) {
          audio = new Audio(res.audioData);
          activeAudioElement = audio;
          audio.onended = () => {
            if (activeAudioElement === audio) activeAudioElement = null;
            onEnd?.();
          };
          audio.onerror = () => {
            if (activeAudioElement === audio) activeAudioElement = null;
            // Fallback to browser synthesis if audio playback failed
            fallbackBrowserSpeech();
          };
          audio.play().catch(() => {
            fallbackBrowserSpeech();
          });
        } else {
          // Cloud synthesis failed, fallback to browser speech synthesis
          fallbackBrowserSpeech();
        }
      })
      .catch(() => {
        if (!canceled) {
          fallbackBrowserSpeech();
        }
      });

    return () => {
      canceled = true;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio = null;
      }
      if (activeAudioElement === audio) {
        activeAudioElement = null;
      }
      onEnd?.();
    };
  }

  function fallbackBrowserSpeech(): () => void {
    if (!isSpeechSynthesisSupported()) {
      onError?.("当前环境不支持语音朗读 (SpeechSynthesis)");
      return () => {};
    }

    const UtteranceClass =
      (window as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance })
        .SpeechSynthesisUtterance ||
      (typeof SpeechSynthesisUtterance !== "undefined" ? SpeechSynthesisUtterance : null);

    if (!UtteranceClass || typeof window === "undefined" || !("speechSynthesis" in window)) {
      onError?.("当前环境不支持语音朗读 (SpeechSynthesisUtterance)");
      return () => {};
    }

    window.speechSynthesis.cancel();

    const utterance = new UtteranceClass(cleanText);
    utterance.lang = /[\u4e00-\u9fa5]/.test(cleanText) ? "zh-CN" : "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      onEnd?.();
    };

    utterance.onerror = (e) => {
      if (e.error !== "canceled" && e.error !== "interrupted") {
        onError?.(`语音朗读错误: ${e.error}`);
      }
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
      onEnd?.();
    };
  }

  return fallbackBrowserSpeech();
}

/**
 * Stops any active speech synthesis (both audio element and window.speechSynthesis).
 */
export function stopSpeaking(): void {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioElement = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
