import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/github";

function gh(path: string, init?: RequestInit) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const githubKey = process.env.GITHUB_API_KEY;
  if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");
  if (!githubKey) throw new Error("GitHub is not connected yet.");
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", githubKey);
  if (init?.body) headers.set("Content-Type", "application/json");
  return fetch(`${GATEWAY}${path}`, { ...init, headers });
}

async function ghJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await gh(path, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub request failed [${res.status}] ${path}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

const FileInput = z.object({ path: z.string().min(1), code: z.string() });

const PushInput = z.object({
  repo: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores"),
  message: z.string().min(1).max(200).default("Update from Opencimpco Code"),
  isPrivate: z.boolean().default(false),
  files: z.array(FileInput).min(1).max(200),
});

/** Scaffold files so Vercel can build a plain React project out of the box. */
function withScaffold(files: { path: string; code: string }[], repo: string) {
  const has = (p: string) => files.some((f) => f.path === p);
  const out = [...files];
  const isReact = files.some((f) => /\.(jsx|tsx)$/.test(f.path));
  if (!isReact) return out;

  const entry =
    files.find((f) => /^src\/main\.(jsx|tsx)$/.test(f.path))?.path ??
    files.find((f) => /\.(jsx|tsx)$/.test(f.path))!.path;

  if (!has("package.json")) {
    out.push({
      path: "package.json",
      code: `${JSON.stringify(
        {
          name: repo.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          private: true,
          type: "module",
          scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
          dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
          devDependencies: { "@vitejs/plugin-react": "^4.3.1", vite: "^5.4.0" },
        },
        null,
        2,
      )}\n`,
    });
  }
  if (!has("vite.config.js")) {
    out.push({
      path: "vite.config.js",
      code: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n`,
    });
  }
  if (!has("index.html")) {
    out.push({
      path: "index.html",
      code: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${repo}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/${entry}"></script>\n  </body>\n</html>\n`,
    });
  }
  if (!has("README.md")) {
    out.push({
      path: "README.md",
      code: `# ${repo}\n\nBuilt with Opencimpco Code.\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
    });
  }
  return out;
}

export const getGithubAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!process.env.GITHUB_API_KEY) return { connected: false as const };
    try {
      const user = await ghJson<{ login: string; avatar_url: string }>("/user");
      return { connected: true as const, login: user.login, avatar: user.avatar_url };
    } catch {
      return { connected: false as const };
    }
  });

/**
 * Create (or reuse) a repo and push every project file as one atomic commit,
 * then hand back a one-click Vercel import link — no personal tokens needed.
 */
export const pushToGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PushInput.parse(input))
  .handler(async ({ data }) => {
    const user = await ghJson<{ login: string }>("/user");
    const owner = user.login;

    let branch = "main";
    const existing = await gh(`/repos/${owner}/${data.repo}`);
    if (existing.status === 404) {
      const created = await ghJson<{ default_branch: string }>("/user/repos", {
        method: "POST",
        body: JSON.stringify({
          name: data.repo,
          private: data.isPrivate,
          auto_init: true,
          description: "Built with Opencimpco Code",
        }),
      });
      branch = created.default_branch || "main";
    } else if (existing.ok) {
      const repo = (await existing.json()) as { default_branch: string };
      branch = repo.default_branch || "main";
    } else {
      const body = await existing.text();
      throw new Error(`GitHub request failed [${existing.status}]: ${body.slice(0, 300)}`);
    }

    // A freshly created repo needs a moment before its ref is readable.
    let baseSha = "";
    for (let attempt = 0; attempt < 6 && !baseSha; attempt++) {
      const ref = await gh(`/repos/${owner}/${data.repo}/git/ref/heads/${branch}`);
      if (ref.ok) {
        baseSha = ((await ref.json()) as { object: { sha: string } }).object.sha;
        break;
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    if (!baseSha) throw new Error("Could not read the repository's default branch yet. Try again.");

    const baseCommit = await ghJson<{ tree: { sha: string } }>(
      `/repos/${owner}/${data.repo}/git/commits/${baseSha}`,
    );

    const files = withScaffold(data.files, data.repo);
    const tree = [];
    for (const file of files) {
      const blob = await ghJson<{ sha: string }>(`/repos/${owner}/${data.repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: file.code, encoding: "utf-8" }),
      });
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    const newTree = await ghJson<{ sha: string }>(`/repos/${owner}/${data.repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
    });

    const commit = await ghJson<{ sha: string }>(`/repos/${owner}/${data.repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: data.message, tree: newTree.sha, parents: [baseSha] }),
    });

    await ghJson(`/repos/${owner}/${data.repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });

    const repoUrl = `https://github.com/${owner}/${data.repo}`;
    return {
      owner,
      repoUrl,
      commitUrl: `${repoUrl}/commit/${commit.sha}`,
      fileCount: files.length,
      // Vercel's import flow authenticates the user in their own browser — no token storage.
      vercelUrl: `https://vercel.com/new/clone?repository-url=${encodeURIComponent(repoUrl)}`,
    };
  });
