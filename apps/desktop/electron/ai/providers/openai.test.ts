import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAccountBalance,
  fetchRemoteModels,
  synthesizeSpeechMiMo,
  transcribeAudioOpenAi,
} from "./openai";
import type { AiSettingsRecord } from "../settings";

vi.mock("../settings", () => ({
  getCloudApiKey: vi.fn(() => "test-sk-123456"),
  getEffectiveCloudApiKey: vi.fn(() => "test-sk-123456"),
  getSttApiKey: vi.fn(() => "test-sk-123456"),
  getTtsApiKey: vi.fn(() => "test-sk-123456"),
}));

describe("OpenAI, DeepSeek & MiMo Provider Functions", () => {
  const baseSettings: AiSettingsRecord = {
    mode: "cloud",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    ollamaHost: "http://127.0.0.1:11434",
    ollamaModel: "llama3.2",
    cloudPrivacyAck: true,
    preferLocalWhenAvailable: false,
    redactSensitiveData: false,
    reasoningEffort: "medium",
    maxTokens: 32768,
    timeoutSeconds: 300,
    sttService: "custom",
    sttBaseUrl: "https://api.openai.com/v1",
    sttModel: "whisper-1",
    ttsService: "custom",
    ttsBaseUrl: "https://api.openai.com/v1",
    ttsModel: "tts-1",
    ttsVoice: "alloy",
    cloudProfiles: [],
    activeCloudProfileId: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchRemoteModels", () => {
    it("fetches local models from Ollama api/tags", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: "llama3.2" }, { name: "qwen2.5:7b" }],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await fetchRemoteModels({ ...baseSettings, mode: "local" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.models).toEqual(["llama3.2", "qwen2.5:7b"]);
      }
    });

    it("returns fallback models when cloud models request errors", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network offline"));
      vi.stubGlobal("fetch", fetchMock);

      const res = await fetchRemoteModels(baseSettings);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.models).toContain("deepseek-chat");
        expect(res.models).toContain("deepseek-reasoner");
      }
    });
  });

  describe("fetchAccountBalance", () => {
    it("parses DeepSeek standard balance info", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_available: true,
          balance_infos: [
            {
              currency: "CNY",
              total_balance: "50.00",
              granted_balance: "10.00",
              topped_up_balance: "40.00",
            },
          ],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await fetchAccountBalance(baseSettings);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.isAvailable).toBe(true);
        expect(res.balanceInfos).toHaveLength(1);
        expect(res.balanceInfos[0].total_balance).toBe("50.00");
      }
    });

    it("handles 404 unsupported balance gracefully", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await fetchAccountBalance({
        ...baseSettings,
        baseUrl: "https://api.openai.com/v1",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("不支持");
      }
    });
  });

  describe("synthesizeSpeechMiMo", () => {
    it("synthesizes audio speech into base64 data url with custom settings", async () => {
      const fakeBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => fakeBuffer,
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await synthesizeSpeechMiMo("Hello world", "nova", {
        ...baseSettings,
        ttsBaseUrl: "https://api.xiaomimimo.com/v1",
        ttsModel: "mimo-tts",
        ttsVoice: "nova",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.audioData).toContain("data:audio/mp3;base64,");
      }
    });
  });

  describe("transcribeAudioOpenAi", () => {
    it("transcribes audio speech buffer into text", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: "这是一封关于明天的测试邮件" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await transcribeAudioOpenAi(Buffer.from("dummy-audio-content"), "audio/webm", {
        ...baseSettings,
        sttBaseUrl: "https://api.openai.com/v1",
        sttModel: "whisper-1",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.text).toBe("这是一封关于明天的测试邮件");
      }
    });
  });
});
