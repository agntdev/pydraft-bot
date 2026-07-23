const GITHUB_API = "https://api.github.com";

interface GitHubConfig {
  token: string;
}

export async function getFileSha(config: GitHubConfig, owner: string, repo: string, path: string, branch: string): Promise<string | null> {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
    headers: {
      "Authorization": `token ${config.token}`,
      "Accept": "application/vnd.github.v3+json",
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

  const data = await response.json() as { sha: string };
  return data.sha;
}

export async function createOrUpdateFile(
  config: GitHubConfig,
  owner: string,
  repo: string,
  path: string,
  content: string,
  branch: string,
  message: string,
): Promise<{ sha: string }> {
  const existingSha = await getFileSha(config, owner, repo, path, branch);

  const body: Record<string, unknown> = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${config.token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to commit ${path}: ${error}`);
  }

  const data = await response.json() as { content: { sha: string } };
  return { sha: data.content.sha };
}

export async function commitFiles(
  config: GitHubConfig,
  owner: string,
  repo: string,
  files: Record<string, string>,
  branch: string,
  message: string,
): Promise<{ committedFiles: string[]; commitShas: string[] }> {
  const committedFiles: string[] = [];
  const commitShas: string[] = [];

  for (const [path, content] of Object.entries(files)) {
    const result = await createOrUpdateFile(config, owner, repo, path, content, branch, message);
    committedFiles.push(path);
    commitShas.push(result.sha);
  }

  return { committedFiles, commitShas };
}
