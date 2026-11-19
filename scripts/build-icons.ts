import { $ } from "bun";

const SOURCES = "assets/icons";
const OUTPUT = "apps/web/public";

const renders = [
  { source: "icon-rounded", size: 192, file: "icon-192.png" },
  { source: "icon-rounded", size: 512, file: "icon-512.png" },
  { source: "icon", size: 512, file: "icon-maskable-512.png" },
  { source: "icon", size: 180, file: "apple-touch-icon.png" },
  { source: "favicon", size: 32, file: "favicon-32.png" },
] as const;

await $`cp ${SOURCES}/favicon.svg ${OUTPUT}/favicon.svg`;
for (const { source, size, file } of renders) {
  await $`rsvg-convert -w ${size} -h ${size} ${SOURCES}/${source}.svg -o ${OUTPUT}/${file}`;
}
