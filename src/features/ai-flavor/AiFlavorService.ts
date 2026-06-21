import type { AiTextGenerator } from '../inspiration-collector';

export interface AiFlavorAnalysis {
  score: number;
  level: 'low' | 'medium' | 'high';
  reasons: string[];
}

export interface AiFlavorRewriteResult {
  text: string;
  score: number;
  attempts: number;
}

const FORMULAIC_PATTERNS: Array<{ pattern: RegExp; reason: string; weight: number }> = [
  { pattern: /空气仿佛凝固|全场震惊|命运的齿轮|他不知道的是|仿佛全世界都安静了/gu, reason: '命中常见模板句', weight: 18 },
  { pattern: /沉默片刻|沉默了一会儿|没有马上回答|没有立刻回答|没有接话|顿了一下|停了一下/gu, reason: '缓冲停顿偏模板化', weight: 10 },
  { pattern: /抬眼|垂眼|盯着|看了[他她]一眼|指节发白|指节泛白/gu, reason: '填充型动作偏多', weight: 8 },
  { pattern: /在当今社会|随着.*发展|近年来/gu, reason: '开头较模板化', weight: 14 },
  { pattern: /值得注意的是|不可忽视的是|毋庸置疑|显而易见/gu, reason: '连接语偏论文腔', weight: 12 },
  { pattern: /不仅.*而且|既.*又|一方面.*另一方面/gu, reason: '句式成组重复', weight: 10 },
  { pattern: /具有重要意义|产生深远影响|采取有效措施|提供有力支撑|这意味着|换句话说|本质上/gu, reason: '抽象套话较多', weight: 14 },
  { pattern: /综上所述|总而言之|由此可见/gu, reason: '结尾较模板化', weight: 16 },
];

const BUFFER_ACTION_PATTERN = /沉默|停顿|顿了|没有马上回答|没有立刻回答|没有接话|抬眼|垂眼|盯着|看了[他她]一眼|心里|指节发白|指节泛白/gu;
const ABSTRACT_JUDGEMENT_PATTERN = /意味着|代表着|说明|本质上|换句话说|也就是说|问题是|价值|意义|体系|机制|趋势|能力|维度|层面|路径|风险|选择/gu;
const EXPLANATORY_PATTERN = /这意味着|这说明|这代表|本质上|换句话说|也就是说|因为|必须重新判断|已经改变|没有更多选择/gu;

const ACTION_GROUPS: Array<{ name: string; pattern: RegExp }> = [
  { name: '看/盯/抬眼', pattern: /看|盯着|抬眼|垂眼/gu },
  { name: '沉默/停顿', pattern: /沉默|停顿|顿了|没有马上回答|没有立刻回答|没有接话/gu },
  { name: '心里表达', pattern: /心里|明白|意识到/gu },
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?；;]/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanAbsoluteDeviation(values: number[]): number {
  const average = mean(values);
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + Math.abs(value - average), 0) / values.length;
}

function perThousand(count: number, characterCount: number): number {
  return characterCount === 0 ? 0 : (count / characterCount) * 1000;
}

function paragraphShape(paragraph: string): string {
  const hasEnvironment = /雨|风|灯|窗|门|走廊|房间|玻璃|街|夜|光|声音/u.test(paragraph);
  const hasAction = /看|抬眼|站|走|停|问|说|递|推|拉|按|盯|沉默/u.test(paragraph);
  const hasPsychSummary = /心里|明白|意识到|意味着|本质上|说明|选择|风险|局面/u.test(paragraph);
  return [hasEnvironment ? 'E' : '-', hasAction ? 'A' : '-', hasPsychSummary ? 'S' : '-'].join('');
}

function stripResponse(text: string): string {
  return text
    .replace(/^```(?:markdown|text)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
}

function buildRewritePrompt(text: string, currentScore: number, targetScore: number): string {
  return [
    `当前本地 AI 味评分：${currentScore}%。目标：降到 ${targetScore}% 以下。`,
    '',
    '请改写下面的中文文本，要求：',
    '- 保留原意、人物、事实和信息量。',
    '- 减少模板化连接词、论文腔、总结腔和空泛判断。',
    '- 增加更具体的动作、感受、细节和自然停顿。',
    '- 不要解释，不要列修改说明，只输出改写后的正文。',
    '',
    '原文：',
    text,
  ].join('\n');
}

export function extractCurrentMarkdownChapter(markdown: string, cursorLine: number): string {
  const lines = markdown.split(/\r?\n/u);
  const safeCursorLine = Math.max(0, Math.min(cursorLine, lines.length - 1));
  let start = -1;

  for (let line = safeCursorLine; line >= 0; line -= 1) {
    if (/^#{1,6}\s+\S/u.test(lines[line])) {
      start = line;
      break;
    }
  }

  if (start === -1) {
    return markdown.trim();
  }

  const headingLevel = lines[start].match(/^(#{1,6})\s/u)?.[1].length ?? 1;
  let end = lines.length;
  for (let line = start + 1; line < lines.length; line += 1) {
    const match = lines[line].match(/^(#{1,6})\s/u);
    if (match && match[1].length <= headingLevel) {
      end = line;
      break;
    }
  }

  return lines.slice(start, end).join('\n').trim();
}

export class AiFlavorService {
  constructor(private readonly generator?: AiTextGenerator) {}

  analyze(text: string): AiFlavorAnalysis {
    const normalized = text.replace(/\s+/gu, ' ').trim();
    if (!normalized) {
      return { score: 0, level: 'low', reasons: ['没有可检测文本'] };
    }

    let score = 0;
    const reasons = new Set<string>();
    const characterCount = normalized.length;
    for (const { pattern, reason, weight } of FORMULAIC_PATTERNS) {
      const matches = normalized.match(pattern);
      if (!matches) continue;
      score += Math.min(weight * matches.length, weight * 2);
      reasons.add(reason);
    }

    const sentences = splitSentences(normalized);
    if (sentences.length >= 3) {
      const lengths = sentences.map((sentence) => sentence.length);
      const average = mean(lengths);
      const variance = meanAbsoluteDeviation(lengths);
      if (average > 24 && variance < 8) {
        score += 12;
        reasons.add('句长过于整齐');
      }
    }

    const bufferDensity = perThousand(countMatches(normalized, BUFFER_ACTION_PATTERN), characterCount);
    if (bufferDensity >= 18) {
      score += 18;
      reasons.add('缓冲动作密度偏高');
    }

    const abstractDensity = perThousand(countMatches(normalized, ABSTRACT_JUDGEMENT_PATTERN), characterCount);
    if (abstractDensity >= 15) {
      score += 16;
      reasons.add('抽象判断密度偏高');
    }

    for (const group of ACTION_GROUPS) {
      if (countMatches(normalized, group.pattern) >= 3) {
        score += 10;
        reasons.add('同类动作重复偏多');
        break;
      }
    }

    const paragraphs = splitParagraphs(text);
    if (paragraphs.length >= 3) {
      const paragraphLengths = paragraphs.map((paragraph) => paragraph.length);
      if (mean(paragraphLengths) > 35 && meanAbsoluteDeviation(paragraphLengths) < 12) {
        score += 12;
        reasons.add('段落长度过于均匀');
      }

      const shapes = paragraphs.map(paragraphShape);
      const repeatedShapes = shapes.filter((shape) => shape === 'EAS').length;
      if (repeatedShapes >= Math.min(3, paragraphs.length)) {
        score += 14;
        reasons.add('连续段落结构过于相似');
      }
    }

    const explanatoryDensity = perThousand(countMatches(normalized, EXPLANATORY_PATTERN), characterCount);
    if (explanatoryDensity >= 12) {
      score += 14;
      reasons.add('解释型对话或旁白偏多');
    }

    const abstractWords = normalized.match(/价值|意义|体系|机制|趋势|能力|维度|层面|路径/gu)?.length ?? 0;
    if (abstractWords >= 4) {
      score += Math.min(abstractWords * 3, 18);
      reasons.add('抽象名词密度偏高');
    }

    const finalScore = clampScore(score);
    return {
      score: finalScore,
      level: finalScore >= 60 ? 'high' : finalScore >= 30 ? 'medium' : 'low',
      reasons: reasons.size > 0 ? Array.from(reasons) : ['未发现明显模板化特征'],
    };
  }

  async rewriteBelowTarget(
    text: string,
    options: { targetScore?: number; maxAttempts?: number } = {},
  ): Promise<AiFlavorRewriteResult> {
    if (!this.generator) {
      throw new Error('AI rewrite service is unavailable.');
    }

    const targetScore = options.targetScore ?? 30;
    const maxAttempts = options.maxAttempts ?? 3;
    let currentText = text.trim();
    let currentScore = this.analyze(currentText).score;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const rewritten = stripResponse(await this.generator.generate({
        systemPrompt: '你是 MuseAI 的中文文本降 AI 味改写助手。你只输出改写后的正文。',
        prompt: buildRewritePrompt(currentText, currentScore, targetScore),
      }));
      if (rewritten) {
        currentText = rewritten;
        currentScore = this.analyze(currentText).score;
      }
      if (currentScore <= targetScore) {
        return { text: currentText, score: currentScore, attempts: attempt };
      }
    }

    return { text: currentText, score: currentScore, attempts: maxAttempts };
  }
}
