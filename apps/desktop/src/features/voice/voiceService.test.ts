import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startSpeechRecognition,
  stopSpeaking,
} from "./voiceService";
import { useAiSettings } from "../ai/settingsStore";
import * as ipc from "../../lib/ipc";

vi.mock("../../lib/ipc", async () => {
  const actual = await vi.importActual<typeof ipc>("../../lib/ipc");
  return {
    ...actual,
    aiSynthesizeSpeech: vi.fn(),
    aiTranscribeAudio: vi.fn(),
  };
});

describe("Voice Service (STT & TTS)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAiSettings.setState({
      sttService: "browser",
      ttsService: "browser",
    });
  });

  describe("Speech Recognition (STT)", () => {
    it("returns false if recognition is not supported in environment", () => {
      const original = (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
      // @ts-expect-error test override
      delete window.webkitSpeechRecognition;
      // @ts-expect-error test override
      delete window.SpeechRecognition;

      const errorFn = vi.fn();
      const cancel = startSpeechRecognition(vi.fn(), errorFn);
      expect(errorFn).toHaveBeenCalledWith(
        expect.stringMatching(/不支持语音识别|未找到可用语音识别引擎/)
      );
      expect(typeof cancel).toBe("function");

      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
        original;
    });

    it("creates recognition instance and handles results in browser mode", () => {
      class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = "";
        start = vi.fn();
        stop = vi.fn();
        abort = vi.fn();
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
      }

      // @ts-expect-error mock window recognition
      window.SpeechRecognition = MockSpeechRecognition;

      expect(isSpeechRecognitionSupported()).toBe(true);

      const resultFn = vi.fn();
      const cancel = startSpeechRecognition(resultFn);

      expect(typeof cancel).toBe("function");
      cancel();
    });
  });

  describe("Speech Synthesis (TTS)", () => {
    beforeEach(() => {
      // Mock HTML Audio element for jsdom environment
      // @ts-expect-error test mock
      global.Audio = class {
        play = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn();
        currentTime = 0;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(_src?: string) {}
      };
    });

    it("detects speech synthesis support and speaks via SpeechSynthesis in browser mode", () => {
      const mockSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      };
      // @ts-expect-error mock window synthesis
      window.speechSynthesis = mockSynthesis;
      // @ts-expect-error mock utterance
      global.SpeechSynthesisUtterance = class {
        text = "";
        lang = "";
        rate = 1.0;
        pitch = 1.0;
        onend: (() => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      };

      expect(isSpeechSynthesisSupported()).toBe(true);

      const endFn = vi.fn();
      const cancel = speakText("<b>Hello</b> *world*", endFn);

      expect(mockSynthesis.cancel).toHaveBeenCalled();
      expect(mockSynthesis.speak).toHaveBeenCalled();
      expect(typeof cancel).toBe("function");

      stopSpeaking();
      expect(mockSynthesis.cancel.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("handles custom model TTS mode by invoking aiSynthesizeSpeech", async () => {
      useAiSettings.setState({
        ttsService: "custom",
        ttsBaseUrl: "https://api.openai.com/v1",
        ttsModel: "tts-1",
        ttsVoice: "alloy",
      });

      vi.mocked(ipc.aiSynthesizeSpeech).mockResolvedValue({
        ok: true,
        audioData: "data:audio/mp3;base64,dGVzdA==",
      });

      const endFn = vi.fn();
      const cancel = speakText("测试语音大模型朗读", endFn);
      expect(typeof cancel).toBe("function");
      expect(ipc.aiSynthesizeSpeech).toHaveBeenCalledWith(
        expect.objectContaining({ text: "测试语音大模型朗读", voice: "alloy" })
      );
    });

    it("handles empty text gracefully", () => {
      const mockSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
      };
      // @ts-expect-error mock window synthesis
      window.speechSynthesis = mockSynthesis;

      const endFn = vi.fn();
      speakText("", endFn);

      expect(endFn).toHaveBeenCalled();
    });
  });
});
