const DEFAULT_QUESTION_TYPES = [
  { from: 1, to: 60, type: "single", label: "\u5355\u9009\u9898" },
  { from: 61, to: 80, type: "multiple", label: "\u591a\u9009\u9898" },
  { from: 81, to: 100, type: "judgement", label: "\u5224\u65ad\u9898" },
];

const TYPE_LABELS = {
  single: "\u5355\u9009\u9898",
  multiple: "\u591a\u9009\u9898",
  judgement: "\u5224\u65ad\u9898",
  unknown: "\u672a\u77e5\u9898\u578b",
};

const ANSWER_LABEL_PATTERN_SOURCE = "\u6b63\u786e\u7b54\u6848|\u53c2\u8003\u7b54\u6848|\u6807\u51c6\u7b54\u6848|\u7b54\u6848";
const QUESTION_TYPE_PATTERN_SOURCE = "\u5355\u9009\u9898|\u591a\u9009\u9898|\u5224\u65ad\u9898|\u586b\u7a7a\u9898|\u7b80\u7b54\u9898";
const NOISE_PATTERN_SOURCE = "\u6b64\u4f5c\u4e1a\u8bf7\u5728|\u8fdb\u5ea6\uff1a|\u7b54\u9898\u5361";

function detectQuestionTypeFromText(text) {
  const source = String(text || "");
  if (/\u591a\u9009\u9898/.test(source)) return "multiple";
  if (/\u5355\u9009\u9898/.test(source)) return "single";
  if (/\u5224\u65ad\u9898/.test(source)) return "judgement";
  return "unknown";
}

function getQuestionType(index, questionTypes) {
  const ranges = Array.isArray(questionTypes) ? questionTypes : DEFAULT_QUESTION_TYPES;
  const found = ranges.find((item) => index >= item.from && index <= item.to);
  return found ? found.type : "unknown";
}

function getQuestionTypeLabel(type) {
  return TYPE_LABELS[type] || TYPE_LABELS.unknown;
}

function normalizeAnswer(answer, questionType) {
  const text = String(answer || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(/[\uFF0C\u3001;\uFF1B|/]/g, ",")
    .trim();

  if (!text) return "";

  if (questionType === "judgement") {
    if (/^(?:\u6b63\u786e|\u5bf9|\u662f|true|t|yes|y|\u221a|\u2713|\u2714)$/i.test(text)) return "True";
    if (/^(?:\u9519\u8bef|\u9519|\u5426|false|f|no|n|x|\u00d7|\u2715|\u2716)$/i.test(text)) return "False";
  }

  const letters = text.match(/[A-H]/gi);
  if (!letters) return text;
  const uniqueLetters = Array.from(new Set(letters.map((letter) => letter.toUpperCase())));
  return questionType === "multiple" ? uniqueLetters.join(",") : uniqueLetters[0];
}

function extractByNearbyLabel(source, questionType) {
  const labels = ["\u6b63\u786e\u7b54\u6848", "\u53c2\u8003\u7b54\u6848", "\u6807\u51c6\u7b54\u6848", "\u7b54\u6848"];
  for (const label of labels) {
    const index = source.indexOf(label);
    if (index === -1) continue;
    const nearby = source.slice(index + label.length, index + label.length + 80);
    if (questionType === "judgement") {
      const judgement = nearby.match(/[\u6b63\u786e\u9519\u8bef\u5bf9\u9519\u662f\u5426]|True|False|YES|NO|\u221a|\u2713|\u2714|\u00d7|\u2715|\u2716/iu);
      if (judgement) return normalizeAnswer(judgement[0], questionType);
    }
    const letters = nearby.match(/[A-H](?:\s*[,\uFF0C\u3001;\uFF1B|/]?\s*[A-H])*/i);
    if (letters) return normalizeAnswer(letters[0], questionType);
  }
  return "";
}

function extractAnswerFromText(text, questionType) {
  const source = String(text || "").replace(/\u00a0/g, " ");
  const label = `(?:${ANSWER_LABEL_PATTERN_SOURCE})`;
  const letterPattern = questionType === "multiple"
    ? "([A-H](?:\\s*[,\\uFF0C\\u3001;\\uFF1B|/]?\\s*[A-H])*)"
    : "([A-H])";
  const judgementPattern = "(\\u6b63\\u786e|\\u9519\\u8bef|\\u5bf9|\\u9519|\\u662f|\\u5426|True|False|YES|NO|T|F|\\u221a|\\u2713|\\u2714|\\u00d7|\\u2715|\\u2716)";

  const patterns = questionType === "judgement"
    ? [new RegExp(`${label}\\s*[:\uFF1A]?\\s*${judgementPattern}`, "i")]
    : [
      new RegExp(`${label}\\s*[:\uFF1A]?\\s*${letterPattern}`, "i"),
      new RegExp(`${label}\\s*[:\uFF1A]?\\s*${judgementPattern}`, "i"),
    ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return normalizeAnswer(match[1], questionType);
  }

  return extractByNearbyLabel(source, questionType);
}

module.exports = {
  ANSWER_LABEL_PATTERN_SOURCE,
  DEFAULT_QUESTION_TYPES,
  NOISE_PATTERN_SOURCE,
  QUESTION_TYPE_PATTERN_SOURCE,
  detectQuestionTypeFromText,
  extractAnswerFromText,
  getQuestionType,
  getQuestionTypeLabel,
  normalizeAnswer,
};
