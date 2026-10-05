import fs from "node:fs";
import path from "node:path";
import { Chat } from "@/components/Chat";
export default function Page() {
  let disclaimer = "This is a student learning project. Not legal advice.";
  try {
    disclaimer = fs.readFileSync(path.join(process.cwd(), "DISCLAIMER.md"), "utf-8");
  } catch {
    /* fallback text */
  }
  return <Chat disclaimer={disclaimer} />;
}