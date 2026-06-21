/*
  XuetangX homework/test image + answer collector.

  Default behavior:
    - Start from the current visible question.
    - Collect until the next button is missing/disabled or maxQuestions is reached.
    - Detect question type from page text when possible.
*/

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");
const {
  ANSWER_LABEL_PATTERN_SOURCE,
  DEFAULT_QUESTION_TYPES,
  NOISE_PATTERN_SOURCE,
  QUESTION_TYPE_PATTERN_SOURCE,
  detectQuestionTypeFromText,
  extractAnswerFromText,
  getQuestionType,
  getQuestionTypeLabel,
} = require("./helpers");

const DEFAULT_CONFIG = {
  title: "\u5b66\u5802\u5728\u7ebf\u4f5c\u4e1a\u7b54\u6848\u6574\u7406",
  startUrl: "https://www.xuetangx.com/",
  outputDir: path.join(__dirname, "..", "xuetangx_homework_export"),
  maxQuestions: 200,
  questionTypes: DEFAULT_QUESTION_TYPES,

  // Fill these after using diagnose mode if auto-detection is inaccurate.
  questionAreaSelector: "",
  answerSelector: "",
  nextButtonText: "\u4e0b\u4e00\u9898",

  delayAfterNextMs: 900,
  browserProfileDir: path.join(__dirname, "..", ".xuetangx-browser-profile"),
  headless: false,
};

function loadConfig() {
  const configArg = process.argv.find((arg) => arg.startsWith("--config="));
  const configPath = configArg ? configArg.slice("--config=".length) : "collector.config.json";
  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) return { ...DEFAULT_CONFIG };
  const userConfig = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    outputDir: userConfig.outputDir ? path.resolve(process.cwd(), userConfig.outputDir) : DEFAULT_CONFIG.outputDir,
    browserProfileDir: userConfig.browserProfileDir ? path.resolve(process.cwd(), userConfig.browserProfileDir) : DEFAULT_CONFIG.browserProfileDir,
  };
}

const CONFIG = loadConfig();

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
  console.log("If screenshots are wrong, copy the best selector to CONFIG.questionAreaSelector or collector.config.json.");
  console.log("If answers are wrong, copy the best answer selector to CONFIG.answerSelector or collector.config.json.\n");
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

async function detectQuestionType(page, sequence, questionArea) {
  const areaText = await questionArea.innerText({ timeout: 1000 }).catch(() => "");
  const bodyText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
  const detected = detectQuestionTypeFromText(`${areaText}\n${bodyText}`);
  if (detected !== "unknown") return detected;
  return getQuestionType(sequence, CONFIG.questionTypes);
}

async function readAnswer(page, questionType) {
  if (CONFIG.answerSelector) {
    const text = await page.locator(CONFIG.answerSelector).first().innerText({ timeout: 3000 }).catch(() => "");
    return extractAnswerFromText(text, questionType) || cleanText(text);
  }

  const bodyText = await page.evaluate(() => document.body.innerText || "");
  return extractAnswerFromText(bodyText, questionType);
}

async function findNextButton(page) {
  const candidates = await page.getByText(CONFIG.nextButtonText, { exact: false }).all();
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const candidate = candidates[i];
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;
    const disabled = await candidate.evaluate((el) => {
      return Boolean(el.disabled) ||
        el.getAttribute("aria-disabled") === "true" ||
        /disabled|is-disabled/.test(String(el.className || ""));
    }).catch(() => false);
    if (!disabled) return candidate;
  }
  return null;
}

async function pageSignature(page) {
  return page.evaluate(() => {
    const text = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    return `${location.href}::${text.slice(0, 600)}`;
  }).catch(() => page.url());
}

async function clickNext(page) {
  const button = await findNextButton(page);
  if (!button) return false;
  const before = await pageSignature(page);
  await button.click({ timeout: 5000 });
  await page.waitForTimeout(CONFIG.delayAfterNextMs);
  const after = await pageSignature(page);
  return before !== after;
}

async function collectOne(page, sequence, imagesDir) {
  const padded = String(sequence).padStart(3, "0");
  const imageFile = path.join(imagesDir, `q${padded}.png`);
  const questionArea = await findQuestionArea(page);
  await questionArea.screenshot({ path: imageFile });
  const questionType = await detectQuestionType(page, sequence, questionArea);
  const answer = await readAnswer(page, questionType);

  return {
    index: sequence,
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

  console.log("Browser opened. Log in to XuetangX and open the first question on the answer-review page.");
  console.log("Type d then Enter to inspect selectors, or just press Enter to collect.");
  const input = (await ask("> ")).trim().toLowerCase();

  if (input === "d") {
    await diagnose(page);
    await ask("Press Enter to start, or Ctrl+C to edit CONFIG/config file first.");
  }

  const results = [];
  for (let i = 1; i <= CONFIG.maxQuestions; i += 1) {
    console.log(`Collecting ${i}/${CONFIG.maxQuestions}...`);
    const item = await collectOne(page, i, imagesDir);
    results.push(item);
    console.log(`  type: ${item.typeLabel}; answer: ${item.answer || "not detected"}`);

    const moved = await clickNext(page);
    if (!moved) {
      console.log("No available next question detected; collection stopped.");
      break;
    }
  }

  const dataFile = path.join(CONFIG.outputDir, "data.json");
  fs.writeFileSync(dataFile, JSON.stringify({ title: CONFIG.title, items: results }, null, 2), "utf8");
  console.log(`Collected data: ${dataFile}`);
  console.log("Next: npm run docx");

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
