/*
  Generate a Word document from collected XuetangX homework images and answers.

  Run:
    npm install
    node make_xuetangx_docx.js
*/

const fs = require("fs");
const path = require("path");
const { Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } = require("docx");
const { PNG } = require("pngjs");
const { getQuestionTypeLabel } = require("./helpers");

const CONFIG = {
  exportDir: path.join(__dirname, "..", "xuetangx_homework_export"),
  outputDocx: path.join(__dirname, "xuetangx_homework_export", "xuetangx_homework_answers.docx"),
  maxImageWidth: 560,
};

function imageTransform(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  let dimensions = { width: CONFIG.maxImageWidth, height: 300 };
  if (path.extname(imagePath).toLowerCase() === ".png") {
    dimensions = PNG.sync.read(buffer);
  }
  const width = Math.min(CONFIG.maxImageWidth, dimensions.width || CONFIG.maxImageWidth);
  const ratio = width / (dimensions.width || width);
  const height = Math.round((dimensions.height || 300) * ratio);
  return { width, height };
}

function imageType(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpg";
  if (ext === ".gif") return "gif";
  if (ext === ".bmp") return "bmp";
  return "png";
}

function buildDocument(items, title) {
  const children = [
    new Paragraph({
      text: "\u5b66\u5802\u5728\u7ebf\u4f5c\u4e1a\u7b54\u6848\u6574\u7406",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun(`\u751f\u6210\u65f6\u95f4\uff1a${new Date().toLocaleString()}`),
      ],
    }),
  ];

  let currentType = "";
  for (const item of items) {
    const typeLabel = item.typeLabel || getQuestionTypeLabel(item.type);
    if (typeLabel !== currentType) {
      currentType = typeLabel;
      children.push(
        new Paragraph({
          text: typeLabel,
          heading: HeadingLevel.HEADING_1,
        })
      );
    }

    children.push(
      new Paragraph({
        text: `\u7b2c ${item.index} \u9898`,
        heading: HeadingLevel.HEADING_2,
      })
    );

    if (fs.existsSync(item.image)) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: fs.readFileSync(item.image),
              type: imageType(item.image),
              transformation: imageTransform(item.image),
            }),
          ],
        })
      );
    } else {
      children.push(new Paragraph(`\u9898\u76ee\u56fe\u7247\u7f3a\u5931\uff1a${item.image}`));
    }

    if (item.answer) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "\u6b63\u786e\u7b54\u6848\uff1a", bold: true }),
            new TextRun(item.answer),
          ],
        })
      );
    }
  }

  return new Document({
    sections: [{ children }],
  });
}

async function main() {
  const dataFile = path.join(CONFIG.exportDir, "data.json");
  if (!fs.existsSync(dataFile)) {
    throw new Error(`Missing ${dataFile}. Run collect_xuetangx_homework.js first.`);
  }

  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const items = Array.isArray(data) ? data : data.items;
  const title = Array.isArray(data) ? undefined : data.title;
  const doc = buildDocument(items, title);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(CONFIG.outputDocx, buffer);
  console.log(`Word generated: ${CONFIG.outputDocx}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});





