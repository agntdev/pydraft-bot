import type { RedisLike } from "../toolkit/session/redis.js";

const INVITE_INDEX_KEY = "invite:index";
const USER_PREFIX = "user:";
const PROJECT_PREFIX = "project:";

export interface UserData {
  telegramId: number;
  githubToken?: string;
  isOwner?: boolean;
  joinedAt: string;
}

export interface ProjectData {
  id: string;
  ownerId: number;
  files: Record<string, string>;
  createdAt: string;
}

async function getRedisClient(): Promise<RedisLike> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not configured for persistent storage");

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const ioredis: any = require("ioredis");
  const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
  const client = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
  return client as RedisLike;
}

let cachedClient: RedisLike | null = null;

async function getClient(): Promise<RedisLike> {
  if (!cachedClient) {
    cachedClient = await getRedisClient();
  }
  return cachedClient;
}

export async function isUserInvited(telegramId: number): Promise<boolean> {
  try {
    const client = await getClient();
    const members = await client.get(INVITE_INDEX_KEY);
    if (!members) return false;
    const list = JSON.parse(members) as number[];
    return list.includes(telegramId);
  } catch {
    return false;
  }
}

export async function addUserToWhitelist(telegramId: number): Promise<void> {
  const client = await getClient();
  const members = await client.get(INVITE_INDEX_KEY);
  const list = members ? (JSON.parse(members) as number[]) : [];
  if (!list.includes(telegramId)) {
    list.push(telegramId);
    await client.set(INVITE_INDEX_KEY, JSON.stringify(list));
  }

  const existing = await getUser(telegramId);
  if (!existing) {
    await saveUser(telegramId, { telegramId, joinedAt: new Date().toISOString() });
  }
}

export async function removeUserFromWhitelist(telegramId: number): Promise<void> {
  const client = await getClient();
  const members = await client.get(INVITE_INDEX_KEY);
  if (!members) return;
  const list = (JSON.parse(members) as number[]).filter(id => id !== telegramId);
  await client.set(INVITE_INDEX_KEY, JSON.stringify(list));
  await client.del(`${USER_PREFIX}${telegramId}`);
}

export async function getWhitelistedUsers(): Promise<number[]> {
  try {
    const client = await getClient();
    const members = await client.get(INVITE_INDEX_KEY);
    return members ? (JSON.parse(members) as number[]) : [];
  } catch {
    return [];
  }
}

export async function getUser(telegramId: number): Promise<UserData | null> {
  try {
    const client = await getClient();
    const data = await client.get(`${USER_PREFIX}${telegramId}`);
    return data ? (JSON.parse(data) as UserData) : null;
  } catch {
    return null;
  }
}

export async function saveUser(telegramId: number, data: UserData): Promise<void> {
  const client = await getClient();
  await client.set(`${USER_PREFIX}${telegramId}`, JSON.stringify(data));
}

export async function saveProject(id: string, data: ProjectData): Promise<void> {
  const client = await getClient();
  await client.set(`${PROJECT_PREFIX}${id}`, JSON.stringify(data));
}

export async function getProject(id: string): Promise<ProjectData | null> {
  try {
    const client = await getClient();
    const data = await client.get(`${PROJECT_PREFIX}${id}`);
    return data ? (JSON.parse(data) as ProjectData) : null;
  } catch {
    return null;
  }
}
