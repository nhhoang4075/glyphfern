import { Glob } from "bun";

const codeFiles = new Glob("{apps,packages,scripts}/**/*.{ts,tsx,js,jsx,css,html}");
const commentLine = /^\s*(\/\/|\/\*|\*\s|\*\/|<!--)/;
const allowedDirectives = /^\s*\/\/\s*(biome-ignore|@ts-expect-error)/;

const offenders: string[] = [];
for await (const path of codeFiles.scan(".")) {
  if (path.includes("node_modules")) continue;
  const lines = (await Bun.file(path).text()).split("\n");
  lines.forEach((line, index) => {
    if (commentLine.test(line) && !allowedDirectives.test(line)) {
      offenders.push(`${path}:${index + 1}`);
    }
  });
}

if (offenders.length > 0) {
  console.error(`Comments are not allowed in code files:\n${offenders.join("\n")}`);
  process.exit(1);
}
