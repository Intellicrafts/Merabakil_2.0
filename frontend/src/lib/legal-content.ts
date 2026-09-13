import fs from "fs";
import path from "path";

const LEGAL_DIR = path.join(process.cwd(), "src/content/legal");

export function loadLegalMarkdown(filename: string): string {
  return fs.readFileSync(path.join(LEGAL_DIR, filename), "utf-8");
}
