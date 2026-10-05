// Shared by server (encode) and browser (parse).
export function sseEncode(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }
  
  export function parseSse(buffer: string): { events: { event: string; data: string }[]; rest: string } {
    const events: { event: string; data: string }[] = [];
    const blocks = buffer.split("\n\n");
    const rest = blocks.pop() ?? "";
    for (const b of blocks) {
      let event = "message";
      let data = "";
      for (const line of b.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      events.push({ event, data });
    }
    return { events, rest };
}