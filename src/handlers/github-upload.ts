import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard, confirmKeyboard } from "../toolkit/index.js";
import { commitFiles } from "../integrations/github.js";

registerMainMenuItem({ label: "⬆️ Upload to GitHub", data: "github:upload", order: 30 });

const composer = new Composer<Ctx>();

composer.callbackQuery("github:upload", async (ctx) => {
  await ctx.answerCallbackQuery();

  const files = ctx.session.generatedFiles;
  if (!files || Object.keys(files).length === 0) {
    await ctx.reply("No project to upload. Tap 📝 Generate code first.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    await ctx.reply("GitHub integration isn't configured. Contact the admin.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  ctx.session.step = "awaiting_github_repo";
  await ctx.reply("Which repository? (e.g. username/repo-name)", {
    reply_markup: { force_reply: true, input_field_placeholder: "owner/repo" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_github_repo") return next();

  const repo = ctx.message.text.trim();
  const match = repo.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
  if (!match) {
    await ctx.reply("Use the format owner/repo-name. Try again.");
    return;
  }

  ctx.session.githubRepo = repo;
  ctx.session.step = "awaiting_github_branch";
  await ctx.reply("Which branch?", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. main" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_github_branch") return next();

  const branch = ctx.message.text.trim();
  if (!branch || branch.includes(" ")) {
    await ctx.reply("Invalid branch name. Try again.");
    return;
  }

  ctx.session.githubBranch = branch;
  ctx.session.step = "awaiting_github_path";
  await ctx.reply("File path prefix? (or leave empty for root)", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. src/" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_github_path") return next();

  const path = ctx.message.text.trim().replace(/^\/+|\/+$/g, "");
  ctx.session.githubPath = path;

  const files = ctx.session.generatedFiles || {};
  const fileList = Object.keys(files).map(f => path ? `${path}/${f}` : f).join("\n");

  ctx.session.step = "confirming_github_upload";
  await ctx.reply(
    `Ready to commit ${Object.keys(files).length} file(s) to ${ctx.session.githubRepo}@${ctx.session.githubBranch}:\n\n${fileList}`,
    { reply_markup: confirmKeyboard("github:confirm") },
  );
});

composer.callbackQuery("github:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();

  const token = process.env.GITHUB_TOKEN;
  const repo = ctx.session.githubRepo;
  const branch = ctx.session.githubBranch;
  const pathPrefix = ctx.session.githubPath || "";
  const files = ctx.session.generatedFiles;

  if (!token || !repo || !branch || !files) {
    await ctx.reply("Missing upload details. Start over.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    ctx.session.step = "idle";
    return;
  }

  const [owner, repoName] = repo.split("/");
  const placeholder = await ctx.reply("⏳ Uploading to GitHub…");

  try {
    const filesWithPaths: Record<string, string> = {};
    for (const [name, content] of Object.entries(files)) {
      const fullPath = pathPrefix ? `${pathPrefix}/${name}` : name;
      filesWithPaths[fullPath] = content;
    }

    const result = await commitFiles(
      { token },
      owner,
      repoName,
      filesWithPaths,
      branch,
      `Add generated Python files via AGNTDEV bot`,
    );

    await ctx.api.editMessageText(
      ctx.chat!.id,
      placeholder.message_id,
      `✅ Committed ${result.committedFiles.length} file(s) to ${repo}@${branch}`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬆️ Upload again", "github:upload")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await ctx.api.editMessageText(
      ctx.chat!.id,
      placeholder.message_id,
      `Upload failed: ${msg.slice(0, 200)}`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("🔄 Try again", "github:upload")],
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
  }

  ctx.session.step = "idle";
});

composer.callbackQuery("github:confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "idle";
  await ctx.reply("Upload cancelled.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
