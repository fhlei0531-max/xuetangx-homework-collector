const assert = require("assert");
const {
  detectQuestionTypeFromText,
  getQuestionType,
  normalizeAnswer,
  extractAnswerFromText,
} = require("../src/helpers");

assert.strictEqual(getQuestionType(1), "single");
assert.strictEqual(getQuestionType(60), "single");
assert.strictEqual(getQuestionType(61), "multiple");
assert.strictEqual(getQuestionType(80), "multiple");
assert.strictEqual(getQuestionType(81), "judgement");
assert.strictEqual(getQuestionType(100), "judgement");
assert.strictEqual(getQuestionType(3, [{ from: 1, to: 5, type: "judgement" }]), "judgement");
assert.strictEqual(getQuestionType(6, [{ from: 1, to: 5, type: "judgement" }]), "unknown");

assert.strictEqual(detectQuestionTypeFromText("\u5355\u9009\u9898 (1\u5206)"), "single");
assert.strictEqual(detectQuestionTypeFromText("\u591a\u9009\u9898 (2\u5206)"), "multiple");
assert.strictEqual(detectQuestionTypeFromText("\u5224\u65ad\u9898 (1\u5206)"), "judgement");
assert.strictEqual(detectQuestionTypeFromText("Question 1"), "unknown");

assert.strictEqual(normalizeAnswer("A", "single"), "A");
assert.strictEqual(normalizeAnswer("A, C", "multiple"), "A,C");
assert.strictEqual(normalizeAnswer("ACD", "multiple"), "A,C,D");
assert.strictEqual(normalizeAnswer("\u6b63\u786e", "judgement"), "True");
assert.strictEqual(normalizeAnswer("\u9519", "judgement"), "False");
assert.strictEqual(normalizeAnswer("\u662f", "judgement"), "True");
assert.strictEqual(normalizeAnswer("\u5426", "judgement"), "False");
assert.strictEqual(normalizeAnswer("\u221a", "judgement"), "True");
assert.strictEqual(normalizeAnswer("\u00d7", "judgement"), "False");

assert.strictEqual(extractAnswerFromText("\u6b63\u786e\u7b54\u6848\uff1aB", "single"), "B");
assert.strictEqual(extractAnswerFromText("\u53c2\u8003\u7b54\u6848\uff1aA\u3001C\u3001D", "multiple"), "A,C,D");
assert.strictEqual(extractAnswerFromText("\u7b54\u6848\uff1a\u9519\u8bef", "judgement"), "False");
assert.strictEqual(extractAnswerFromText("\u6807\u51c6\u7b54\u6848\uff1a\u662f", "judgement"), "True");
assert.strictEqual(extractAnswerFromText("\u6b63\u786e\u7b54\u6848\n\u00d7", "judgement"), "False");

console.log("xuetangx helper tests passed");
