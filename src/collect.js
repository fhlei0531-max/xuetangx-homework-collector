/*
  XuetangX homework image + answer collector.

  Run:
    npm install playwright
    node collect_xuetangx_homework.js

  Question type map:
    1-60: single choice
    61-80: multiple choice
    81-100: judgement
*/

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");
const {
  ANSWER_LABEL_PATTERN_SOURCE,
  NOISE_PATTERN_SOURCE,
  QUESTION_TYPE_PATTERN_SOURCE,
  extractAnswerFromText,
  getQuestionType,
  getQuestionTypeLabel,
} = require("./helpers");

const CONFIG = {
  totalQuestions: 100,
  startUrl: "https://www.xuetangx.com/",
  outputDir: path.join(__dirname, "..", "xuetangx_homework_export"),

  // Fill these after using diagnose mode if auto-detection is inaccurate.
  questionAreaSelector: "",
  answerSelector: "",
  nextButtonText: "\u4e0b\u4e00\u9898",

  delayAfterNextMs: 900,
  browserProfileDir: path.join(__dirname, "..", ".xuetangx-browser-profile"),
  headless: false,
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const ask = (question) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const cleanText = (text) => (text || "")
  .replace(/\u00a0/g, " ")
  .replace(/[ \t]+/g, " ")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

async function visibleLocator(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 3000 });
  return locator;
}

async function diagnose(page) {
  const candidates = await page.evaluate((patterns) => {
    const clean = (text) => (text || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0" && r.width > 0 && r.height > 0;
    };

    const selectorHint = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const cls = Array.from(el.classList || []).slice(0, 4);
      if (cls.length) return `${el.tagName.toLowerCase()}.${cls.map((name) => CSS.escape(name)).join(".")}`;
      return el.tagName.toLowerCase();
    };

    const questionTypePattern = new RegExp(patterns.questionType);
    const answerLabelPattern = new RegExp(patterns.answerLabel);
    const noisePattern = new RegExp(patterns.noise);

    return Array.from(document.querySelectorAll("div, section, article, form, main, [class*='question'], [class*='problem'], [class*='answer'], [class*='subject']"))
      .filter(visible)
      .map((el) => {
        const text = clean(el.innerText || el.textContent || "");
        const imgCount = el.querySelectorAll("img, canvas, svg").length;
        const score =
          imgCount * 1200 +
          (questionTypePattern.test(text) ? 1600 : 0) +
          (answerLabelPattern.test(text) ? 1600 : 0) -
          (noisePattern.test(text) ? 2200 : 0) -
          Math.max(0, text.length - 1600);

        return {
          selector: selectorHint(el),
          score,
          imgCount,
          textPreview: text.slice(0, 180),
        };
      })
      .filter((item) => item.textPreview || item.imgCount)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, {
    questionType: QUESTION_TYPE_PATTERN_SOURCE,
    answerLabel: ANSWER_LABEL_PATTERN_SOURCE,
    noise: NOISE_PATTERN_SOURCE,
  });

  console.log("\nCandidate question/answer areas:");
  console.table(candidates);
  console.log("If screenshots are wrong, copy the best selector to CONFIG.questionAreaSelector.");
  console.log("If answers are wrong, copy the best answer selector to CONFIG.answerSelector.\n");
}

async function findQuestionArea(page) {
  if (CONFIG.questionAreaSelector) return visibleLocator(page, CONFIG.questionAreaSelector);

  const selector = await page.evaluate((patterns) => {
    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0" && r.width > 0 && r.height > 0;
    };

    const selectorHint = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const cls = Array.from(el.classList || []).slice(0, 4);
      if (cls.length) return `${el.tagName.toLowerCase()}.${cls.map((name) => CSS.escape(name)).join(".")}`;
      return el.tagName.toLowerCase();
    };

    const questionTypePattern = new RegExp(patterns.questionType);
    const noisePattern = new RegExp(patterns.noise);

    const candidates = Array.from(document.querySelectorAll("div, section, article, form, main, [class*='question'], [class*='problem'], [class*='subject']"))
      .filter(visible)
      .map((el) => {
        const text = (el.innerText || el.textContent || "").trim();
        const imgCount = el.querySelectorAll("img, canvas, svg").length;
        const score =
          imgCount * 1500 +
          (questionTypePattern.test(text) ? 1000 : 0) -
          (noisePattern.test(text) ? 2500 : 0) -
          Math.max(0, text.length - 1200);
        return { el, score };
      })
      .sort((a, b) => b.score - a.score);

    return candidates[0] ? selectorHint(candidates[0].el) : "body";
  }, {
    questionType: QUESTION_TYPE_PATTERN_SOURCE,
    noise: NOISE_PATTERN_SOURCE,
  });

  return visibleLocator(page, selector);
}

async function readAnswer(page, questionType) {
  if (CONFIG.answerSelector) {
    const text = await page.locator(CONFIG.answerSelector).first().innerText({ timeout: 3000 }).catch(() => "");
    return extractAnswerFromText(text, questionType) || cleanText(text);
  }

  const bodyText = await page.evaluate(() => document.body.innerText || "");
  return extractAnswerFromText(bodyText, questionType);
}

async function clickNext(page) {
  const button = page.getByText(CONFIG.nextButtonText, { exact: false }).last();
  await button.click({ timeout: 5000 });
  await page.waitForTimeout(CONFIG.delayAfterNextMs);
}

async function collectOne(page, index, imagesDir) {
  const questionType = getQuestionType(index);
  const padded = String(index).padStart(3, "0");
  const imageFile = path.join(imagesDir, `q${padded}.png`);
  const questionArea = await findQuestionArea(page);
  await questionArea.screenshot({ path: imageFile });
  const answer = await readAnswer(page, questionType);

  return {
    index,
    type: questionType,
    typeLabel: getQuestionTypeLabel(questionType),
    image: imageFile,
    answer,
    url: page.url(),
    collectedAt: new Date().toISOString(),
  };
}

async function main() {
  ensureDir(CONFIG.outputDir);
  const imagesDir = path.join(CONFIG.outputDir, "images");
  ensureDir(imagesDir);

  const context = await chromium.launchPersistentContext(CONFIG.browserProfileDir, {
    headless: CONFIG.headless,
    viewport: { width: 1365, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(CONFIG.startUrl, { waitUntil: "domcontentloaded" });

  console.log("Browser opened. Log in to XuetangX and open question 1 on the answer-review page.");
  console.log("Type d then Enter to inspect selectors, or just press Enter to collect.");
  const input = (await ask("> ")).trim().toLowerCase();

  if (input === "d") {
    await diagnose(page);
    await ask("Press Enter to start, or Ctrl+C to edit CONFIG first.");
  }

  const results = [];
  for (let i = 1; i <= CONFIG.totalQuestions; i += 1) {
    const type = getQuestionType(i);
    console.log(`Collecting ${i}/${CONFIG.totalQuestions} (${getQuestionTypeLabel(type)})...`);
    const item = await collectOne(page, i, imagesDir);
    results.push(item);
    console.log(`  answer: ${item.answer || "not detected"}`);

    if (i < CONFIG.totalQuestions) {
      await clickNext(page);
    }
  }

  const dataFile = path.join(CONFIG.outputDir, "data.json");
  fs.writeFileSync(dataFile, JSON.stringify(results, null, 2), "utf8");
  console.log(`Collected data: ${dataFile}`);
  console.log("Next: node make_xuetangx_docx.js");

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

