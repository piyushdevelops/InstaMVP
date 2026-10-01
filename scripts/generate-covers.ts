import { mkdir, writeFile } from "node:fs/promises";
import { covers } from "../lib/covers";
async function main() {
  await mkdir("public/covers", { recursive: true });
  for (const c of covers) {
    const lines = c.title.split(" / ");
    const size = lines.some((l) => l.length > 8) ? 61 : 76;
    const text = lines
      .map(
        (line, i) =>
          `<text x="200" y="${210 + i * 82}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="${size}" letter-spacing="-4">${line}</text>`,
      )
      .join("");
    await writeFile(
      `public/covers/${c.id}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 400 534"><rect width="400" height="534" fill="${c.bg}"/><g fill="${c.ink}"><text x="200" y="54" text-anchor="middle" font-family="Arial" font-size="11" letter-spacing="3">THE JUNE SHOP</text><g transform="rotate(${c.number % 2 ? -5 : 0} 200 270)">${text}</g><text x="200" y="450" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="38">2027</text><text x="200" y="478" text-anchor="middle" font-family="Arial" font-size="9" letter-spacing="3">A YEAR OF POSSIBILITIES</text></g><path d="M12 0V534" stroke="${c.ink}" opacity=".18" stroke-width="2"/></svg>`,
    );
  }
}
void main();
