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

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as { SpeechSynthesisUtterance?: unknown };
  return "speechSynthesis" in window && Boolean(win.SpeechSynthesisUtterance || typeof SpeechSynthesisUtterance !== "undefined");
}

/**
 * Starts speech-to-text recognition using Web Speech API.
 * Returns a cancel/stop function.
 */
export function startSpeechRecognition(
  onResult: (text: string, isFinal: boolean) => void,
  onError?: (err: string) => void,
  onEnd?: () => void,
): () => void {
  if (!isSpeechRecognitionSupported()) {
    onError?.("当前环境不支持语音识别 (SpeechRecognition)");
    return () => {};
  }

  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!RecognitionClass) {
    onError?.("未找到语音识别引擎");
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
      msg = "麦克风权限被拒绝，请在系统或浏览器设置中允许麦克风权限";
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

/**
 * Speaks the given text aloud using SpeechSynthesis.
 * Returns a cancel/stop function.
 */
export function speakText(
  text: string,
  onEnd?: () => void,
  onError?: (err: string) => void,
): () => void {
  if (!isSpeechSynthesisSupported()) {
    onError?.("当前环境不支持语音朗读 (SpeechSynthesis)");
    return () => {};
  }

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

  const UtteranceClass =
    (window as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance ||
    (typeof SpeechSynthesisUtterance !== "undefined" ? SpeechSynthesisUtterance : null);

  if (!UtteranceClass) {
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

/**
 * Stops any active speech synthesis.
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
