import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { generatePythonCode } from "../integrations/codegen.js";

registerMainMenuItem({ label: "📝 Generate code", data: "code:generate", order: 10 });

const composer = new Composer<Ctx>();

composer.callbackQuery("code:generate", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_prompt";
  await ctx.reply("Describe the Python project you need.", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. REST API with Flask and SQLite" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_prompt") return next();

  const prompt = ctx.message.text.trim();
  if (prompt.length < 3) {
    await ctx.reply("Please describe your project in a few words.");
    return;
  }

  await ctx.replyWithChatAction("typing");
  const placeholder = await ctx.reply("⏳ Generating code…");

  try {
    const result = await generatePythonCode(prompt);
    const projectId = `proj_${Date.now()}`;
    ctx.session.projectId = projectId;
    ctx.session.generatedFiles = result.files;

    const fileList = Object.keys(result.files).join(", ");
    const preview = Object.entries(result.files)
      .map(([name, content]) => `📄 ${name}\n\`\`\`python\n${content.slice(0, 500)}${content.length > 500 ? "\n…" : ""}\n\`\`\``)
      .join("\n\n");

    await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, `✅ Generated ${Object.keys(result.files).length} file(s): ${fileList}\n\n${preview.slice(0, 3000)}`, {
      reply_markup: inlineKeyboard([
        [inlineButton("📦 Get ZIP", "zip:generate")],
        [inlineButton("⬆️ Upload to GitHub", "github:upload")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    ctx.session.step = "idle";
  } catch (err) {
    await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, "Couldn't generate code. Try rephrasing your request.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    ctx.session.step = "idle";
  }
});

export default composer;
