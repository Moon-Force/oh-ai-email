import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startSpeechRecognition,
  stopSpeaking,
} from "./voiceService";

describe("Voice Service (STT & TTS)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Speech Recognition (STT)", () => {
    it("returns false if recognition is not supported in environment", () => {
      const original = (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
      // @ts-expect-error test override
      delete window.webkitSpeechRecognition;
      // @ts-expect-error test override
      delete window.SpeechRecognition;

      expect(isSpeechRecognitionSupported()).toBe(false);

      const errorFn = vi.fn();
      const cancel = startSpeechRecognition(vi.fn(), errorFn);
      expect(errorFn).toHaveBeenCalledWith(expect.stringContaining("不支持语音识别"));
      expect(typeof cancel).toBe("function");

      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
        original;
    });

    it("creates recognition instance and handles results", () => {
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
    it("detects speech synthesis support", () => {
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
      expect(mockSynthesis.cancel).toHaveBeenCalledTimes(2);
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
