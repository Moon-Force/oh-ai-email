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
    let wavRecorder: { stop: () => void } | null = null;
    const audioChunks: Blob[] = [];
    let isAborted = false;
    let fallbackCleanup: (() => void) | null = null;
    let recordStartMs = 0;
    let hasData = false;
    let pendingStop = false;

    function cleanupMediaStream() {
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
      }
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (isAborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStream = stream;
        const effectiveSttBase = settings.sttBaseUrl || settings.baseUrl || "";
        const effectiveTtsBase = settings.ttsBaseUrl || settings.baseUrl || "";
        const isMimoStt =
          (effectiveSttBase.includes("mimo") ||
            effectiveSttBase.includes("xiaomi") ||
            effectiveTtsBase.includes("mimo") ||
            effectiveTtsBase.includes("xiaomi") ||
            settings.baseUrl.includes("mimo") ||
            settings.baseUrl.includes("xiaomi")) &&
          settings.sttModel.includes("mimo");
        if (isMimoStt) {
          wavRecorder = createMimoWavRecorder(
            stream,
            async (wavBlob) => {
              wavRecorder = null;
              cleanupMediaStream();
              if (isAborted && wavBlob.size === 0) {
                onEnd?.();
                return;
              }
              if (wavBlob.size < 800) {
                onError?.("录音过短，请长按 1-2 秒后松开");
                onEnd?.();
                return;
              }
              const reader = new FileReader();
              reader.onerror = () => {
                onError?.("录音读取失败，请重试");
                onEnd?.();
              };
              reader.onloadend = async () => {
                const base64 = reader.result as string;
                if (!base64 || base64.length < 100) {
                  onError?.("录音转码失败，请重试");
                  onEnd?.();
                  return;
                }
                try {
                  const res = await aiTranscribeAudio({ audioData: base64, mimeType: "audio/wav" });
                  if (res.ok && res.text) onResult(res.text, true);
                  else if (res.ok) onError?.("语音识别返回为空，请重试");
                  else onError?.(res.error || "语音识别失败");
                } catch (err) {
                  onError?.(err instanceof Error ? err.message : "语音识别请求超时或失败");
                } finally {
                  onEnd?.();
                }
              };
              reader.readAsDataURL(wavBlob);
            },
            (errMsg) => {
              wavRecorder = null;
              cleanupMediaStream();
              onError?.(errMsg);
              onEnd?.();
            }
          );
          if (wavRecorder) {
            return;
          }
        }
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/wav";
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.onerror = () => {
          cleanupMediaStream();
          const cleanup = fallbackWebSpeech();
          fallbackCleanup = cleanup;
        };

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunks.push(e.data);
            hasData = true;
          }
          if (pendingStop && hasData) {
            pendingStop = false;
            try {
              mediaRecorder!.stop();
            } catch {
              // ignore
            }
          }
        };

        mediaRecorder.onstop = () => {
          cleanupMediaStream();
          const elapsedMs = recordStartMs ? Date.now() - recordStartMs : 0;
          if (isAborted && audioChunks.length === 0) {
            onEnd?.();
            return;
          }
          if (audioChunks.length === 0 || !hasData) {
            if (elapsedMs < 600) {
              const sec = (elapsedMs / 1000).toFixed(1);
              onError?.(`录音过短（${sec}秒，${audioChunks.length}段），请对着麦克风说一句完整的话再点停止`);
            } else {
              onError?.("未采到声音，可能是麦克风权限或静音，请重试并说话大声一点");
            }
            onEnd?.();
            return;
          }

          const actualMime = mediaRecorder!.mimeType || "audio/webm";
          const blob = new Blob(audioChunks, { type: actualMime });
          if (blob.size < 400 || elapsedMs < 500) {
            const sec = (elapsedMs / 1000).toFixed(1);
            onError?.(`录音过短（${sec}秒，${blob.size}字节），请长按录 1-2 秒再松开`);
            onEnd?.();
            return;
          }
          const reader = new FileReader();
          reader.onerror = () => {
            onError?.("录音读取失败，请重试");
            onEnd?.();
          };
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            if (!base64 || base64.length < 100) {
              onError?.("录音转码失败，请重试");
              onEnd?.();
              return;
            }
            try {
              const res = await aiTranscribeAudio({ audioData: base64, mimeType: actualMime });
              if (res.ok && res.text) {
                onResult(res.text, true);
              } else if (res.ok) {
                onError?.("语音识别返回为空，请检查录音是否有声音或 STT 模型是否正确");
              } else {
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

        recordStartMs = Date.now();
        mediaRecorder.start(200);
      })
      .catch(() => {
        const cleanup = fallbackWebSpeech();
        fallbackCleanup = cleanup;
      });

    return () => {
      if (fallbackCleanup) {
        try {
          fallbackCleanup();
        } catch {
          // ignore
        }
        fallbackCleanup = null;
        cleanupMediaStream();
        onEnd?.();
        return;
      }
      if (wavRecorder) {
        const r = wavRecorder;
        wavRecorder = null;
        try { r.stop(); } catch {}
        return;
      }
      if (mediaRecorder && mediaRecorder.state === "recording") {
        if (!hasData) {
          pendingStop = true;
          mediaRecorder.requestData();
          setTimeout(() => {
            if (pendingStop) {
              pendingStop = false;
              try {
                mediaRecorder!.stop();
              } catch {
                // ignore
              }
            }
          }, 350);
          return;
        }
        try {
          mediaRecorder!.stop();
        } catch {
          // ignore
        }
        return;
      }
      isAborted = true;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        try {
          mediaRecorder.stop();
        } catch {
          // ignore
        }
      }
      cleanupMediaStream();
      if (!mediaRecorder && !wavRecorder) {
        onEnd?.();
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
          const isWav = res.audioData.startsWith("data:audio/wav");
          const mimeForAudio = isWav ? "audio/wav" : "audio/mpeg";
          void mimeForAudio;
          audio = new Audio(res.audioData);
          activeAudioElement = audio;
          audio.onended = () => {
            if (activeAudioElement === audio) activeAudioElement = null;
            onEnd?.();
          };
          audio.onerror = () => {
            if (activeAudioElement === audio) activeAudioElement = null;
            onError?.("云端语音播放失败");
            onEnd?.();
          };
          audio.play().catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            onError?.(`云端音频播放失败：${msg}`);
            onEnd?.();
          });
        } else {
          const err = (res as { error?: string }).error || "云端 TTS 失败：请检查 Base URL / 模型 / Key 是否正确";
          onError?.(err);
          onEnd?.();
        }
      })
      .catch((e) => {
        if (!canceled) {
          onError?.(e instanceof Error ? e.message : "云端 TTS 请求失败");
          onEnd?.();
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

function createMimoWavRecorder(
  stream: MediaStream,
  onWavBlob: (blob: Blob) => void,
  onError: (msg: string) => void
): { stop: () => void } | null {
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const sampleRate = ctx.sampleRate || 16000;
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    let stopped = false;
    processor.onaudioprocess = (e) => {
      if (stopped) return;
      const input = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
    };
    src.connect(processor);
    processor.connect(ctx.destination);
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try { processor.disconnect(); } catch {}
      try { src.disconnect(); } catch {}
      const total = chunks.reduce((s, c) => s + c.length, 0);
      if (total < 800) {
        onError("录音过短，请长按 1-2 秒后松开");
        try { ctx.close(); } catch {}
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      const wavBlob = encodeWavPcm16(merged, sampleRate);
      try { ctx.close(); } catch {}
      stream.getTracks().forEach((t) => t.stop());
      onWavBlob(wavBlob);
    };
    return { stop };
  } catch {
    return null;
  }
}

function encodeWavPcm16(samples: Float32Array, sampleRate: number): Blob {
  const targetRate = 16000;
  let pcm: Float32Array = samples;
  if (sampleRate !== targetRate) {
    const ratio = sampleRate / targetRate;
    const newLen = Math.floor(samples.length / ratio);
    const resampled = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const idx = i * ratio;
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, samples.length - 1);
      const frac = idx - lo;
      resampled[i] = samples[lo] * (1 - frac) + samples[hi] * frac;
    }
    pcm = resampled;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  let off = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
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
