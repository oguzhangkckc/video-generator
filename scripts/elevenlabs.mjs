import { existsSync, readFileSync } from "node:fs";

export const API = "https://api.elevenlabs.io/v1";

export const apiKey = () => {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const line = existsSync(".env")
    ? readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("ELEVENLABS_API_KEY="))
    : undefined;
  const value = line?.slice("ELEVENLABS_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!value) {
    console.error("ELEVENLABS_API_KEY is empty — put it in .env");
    process.exit(2);
  }
  return value;
};
