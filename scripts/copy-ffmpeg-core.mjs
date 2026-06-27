import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "node_modules", "@ffmpeg", "core", "dist", "esm");
const target = join(process.cwd(), "public", "ffmpeg-core");

if (!existsSync(source)) {
  throw new Error("@ffmpeg/core files were not found. Run npm install before building.");
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log("Copied ffmpeg.wasm core to public/ffmpeg-core");
