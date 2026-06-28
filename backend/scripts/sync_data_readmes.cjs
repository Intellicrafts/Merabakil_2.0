const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const yamlPath = path.join(root, "data", "corpus_registry.yaml");
const text = fs.readFileSync(yamlPath, "utf8");

const categories = [];
let cat = null;
let listKey = null;

for (const line of text.split("\n")) {
  if (line.startsWith("  - folder:")) {
    if (cat) categories.push(cat);
    cat = { folder: line.split(":")[1].trim(), answers_for: [], pdf_examples: [] };
    listKey = null;
  } else if (!cat) continue;
  else if (line.match(/^    \w+:/)) {
    listKey = null;
    const idx = line.indexOf(":");
    const key = line.slice(4, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (val.startsWith("-") || key === "answers_for" || key === "pdf_examples") {
      if (key === "answers_for") listKey = "answers_for";
      if (key === "pdf_examples") listKey = "pdf_examples";
      continue;
    }
    cat[key] = val.replace(/^"|"$/g, "");
  }
  if (line.trim() === "answers_for:") listKey = "answers_for";
  if (line.trim() === "pdf_examples:") listKey = "pdf_examples";
  if (listKey === "answers_for" && line.match(/^      - /)) {
    cat.answers_for.push(line.replace(/^      - /, "").trim());
  }
  if (listKey === "pdf_examples" && line.match(/^      - /)) {
    cat.pdf_examples.push(line.replace(/^      - /, "").trim());
  }
}
if (cat) categories.push(cat);

function toReadme(c) {
  const lines = [
    `# ${c.folder}`,
    "",
    c.purpose || "",
    "",
    "## What answers this data improves",
    "",
    ...(c.answers_for || []).map((x) => `- ${x}`),
    "",
    "## Example PDFs to upload",
    "",
    ...(c.pdf_examples || []).map((x) => `- ${x}`),
    "",
    "## Corpus sizing",
    "",
    `- **Minimum recommended:** ${c.recommended_min_pdfs || 1} PDFs`,
    `- **Optimal for best RAG output:** ${c.recommended_optimal_pdfs || 10} PDFs`,
    "",
    "## Ingestion metadata",
    "",
    `- **doc_type:** \`${c.doc_type}\``,
    `- **jurisdiction:** \`${c.jurisdiction}\``,
    "",
    "## Tips",
    "",
    c.ingestion_tips || "",
    "",
  ];
  return lines.join("\n");
}

for (const c of categories) {
  const dir = path.join(root, "data", c.folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), toReadme(c));
  console.log("Wrote", c.folder);
}
console.log("Done", categories.length);
