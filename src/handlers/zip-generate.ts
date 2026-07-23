import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { createZip } from "../integrations/zip.js";

registerMainMenuItem({ label: "📦 Get ZIP", data: "zip:generate", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("zip:generate", async (ctx) => {
  await ctx.answerCallbackQuery();

  const files = ctx.session.generatedFiles;
  if (!files || Object.keys(files).length === 0) {
    await ctx.reply("No project to package yet. Tap 📝 Generate code to create one.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const placeholder = await ctx.reply("⏳ Packaging files…");

  try {
    const zipData = createZip(files);
    const fileName = `${ctx.session.projectId || "project"}.zip`;

    await ctx.api.deleteMessage(ctx.chat!.id, placeholder.message_id);
    await ctx.replyWithDocument(
      new InputFile(new Uint8Array(zipData), fileName),
      { caption: `📦 ${Object.keys(files).length} file(s) packaged.` },
    );
  } catch {
    await ctx.api.editMessageText(ctx.chat!.id, placeholder.message_id, "Couldn't create the ZIP archive. Try again.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
  }
});

export default composer;
