import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { isUserInvited, addUserToWhitelist, removeUserFromWhitelist, getWhitelistedUsers, saveUser, getUser } from "../integrations/storage.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const OWNER_IDS = (process.env.OWNER_IDS || "").split(",").map(Number).filter(Boolean);

function isOwner(userId: number): boolean {
  return OWNER_IDS.includes(userId);
}

const composer = new Composer<Ctx>();

composer.use(async (ctx, next) => {
  if (!ctx.from) return next();

  const userId = ctx.from.id;

  if (isOwner(userId)) {
    let user = await getUser(userId);
    if (!user) {
      await saveUser(userId, { telegramId: userId, isOwner: true, joinedAt: new Date().toISOString() });
      await addUserToWhitelist(userId);
    } else if (!user.isOwner) {
      await saveUser(userId, { ...user, isOwner: true });
    }
    return next();
  }

  if (!process.env.REDIS_URL) {
    return next();
  }

  try {
    const invited = await isUserInvited(userId);
    if (invited) return next();
  } catch {
    return next();
  }

  if (ctx.message || ctx.callbackQuery) {
    await ctx.reply("You don't have access yet. Ask the team admin to invite you.", {
      reply_markup: inlineKeyboard([[inlineButton("❓ Help", "menu:help")]]),
    });
  }
});

composer.command("admin", async (ctx) => {
  if (!ctx.from || !isOwner(ctx.from.id)) return;
  if (!ctx.message) return;

  const args = ctx.message.text.split(/\s+/).slice(1);
  const subcommand = args[0];

  if (subcommand === "add") {
    const targetId = Number(args[1]);
    if (!targetId || isNaN(targetId)) {
      await ctx.reply("Usage: /admin add <user_id>");
      return;
    }
    await addUserToWhitelist(targetId);
    await ctx.reply(`✅ Added ${targetId} to the whitelist.`);
  } else if (subcommand === "remove") {
    const targetId = Number(args[1]);
    if (!targetId || isNaN(targetId)) {
      await ctx.reply("Usage: /admin remove <user_id>");
      return;
    }
    await removeUserFromWhitelist(targetId);
    await ctx.reply(`✅ Removed ${targetId} from the whitelist.`);
  } else if (subcommand === "list") {
    const users = await getWhitelistedUsers();
    if (users.length === 0) {
      await ctx.reply("No users in the whitelist.");
    } else {
      await ctx.reply(`Whitelisted users:\n${users.join("\n")}`);
    }
  } else {
    await ctx.reply(
      "Admin commands:\n" +
      "/admin add <user_id> — Add user to whitelist\n" +
      "/admin remove <user_id> — Remove user\n" +
      "/admin list — Show all whitelisted users",
    );
  }
});

export default composer;
