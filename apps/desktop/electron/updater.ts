import { app, net } from "electron";

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  publishedAt?: string;
}

export function getCurrentAppVersion(): string {
  try {
    return app.getVersion() || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function parseSemver(v: string): number[] {
  const clean = v.replace(/^v/, "").trim();
  return clean.split(".").map((n) => parseInt(n, 10) || 0);
}

export function isNewerVersion(current: string, latest: string): boolean {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForAppUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentAppVersion();
  const repo = "Moon-Force/oh-ai-email";
  const url = `https://api.github.com/repos/${repo}/releases/latest`;

  return new Promise((resolve) => {
    try {
      const request = net.request({
        method: "GET",
        url,
        headers: {
          "User-Agent": `oh-ai-email-desktop/${currentVersion}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      request.on("response", (response) => {
        if (response.statusCode !== 200) {
          resolve({
            updateAvailable: false,
            currentVersion,
            latestVersion: currentVersion,
            releaseNotes: "暂无更新或暂未发布公开版本",
          });
          return;
        }

        let data = "";
        response.on("data", (chunk) => {
          data += chunk.toString();
        });

        response.on("end", () => {
          try {
            const release = JSON.parse(data);
            const latestTag = release.tag_name || release.name || currentVersion;
            const cleanLatest = latestTag.replace(/^v/, "");
            const hasUpdate = isNewerVersion(currentVersion, cleanLatest);

            resolve({
              updateAvailable: hasUpdate,
              currentVersion,
              latestVersion: cleanLatest,
              releaseName: release.name,
              releaseNotes: release.body || "无更新日志说明",
              releaseUrl: release.html_url || `https://github.com/${repo}/releases`,
              publishedAt: release.published_at,
            });
          } catch {
            resolve({
              updateAvailable: false,
              currentVersion,
              latestVersion: currentVersion,
            });
          }
        });
      });

      request.on("error", () => {
        resolve({
          updateAvailable: false,
          currentVersion,
          latestVersion: currentVersion,
        });
      });

      request.end();
    } catch {
      resolve({
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
      });
    }
  });
}
