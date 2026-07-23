const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface CodeGenResult {
  files: Record<string, string>;
}

export async function generatePythonCode(prompt: string): Promise<CodeGenResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const systemPrompt = `You are a Python code generator. Generate a complete Python project based on the user's description.
Output ONLY a JSON object with this exact structure:
{
  "files": {
    "filename.py": "file content here",
    "requirements.txt": "dependencies"
  }
}
Rules:
- Generate practical, runnable Python code
- Include a requirements.txt with all dependencies
- Use standard Python conventions (snake_case, docstrings)
- Keep code clean and well-structured
- No markdown, no explanations, just the JSON`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/agntdev",
      "X-Title": "AGNTDEV Code Generator",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Code generation failed: ${error}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from code generator");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Invalid response format");
  }

  const parsed = JSON.parse(jsonMatch[0]) as { files: Record<string, string> };

  if (!parsed.files || Object.keys(parsed.files).length === 0) {
    throw new Error("No files generated");
  }

  return { files: parsed.files };
}
