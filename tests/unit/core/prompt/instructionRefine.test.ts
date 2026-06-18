import {
  buildPromptOptimizeSystemPrompt,
  parseInstructionRefineResponse,
} from '@/core/prompt/instructionRefine';

describe('instructionRefine prompt optimization', () => {
  it('guides prompt optimization toward actionable Chinese writing instructions', () => {
    const prompt = buildPromptOptimizeSystemPrompt();

    expect(prompt).toContain('Chinese writing workflows');
    expect(prompt).toContain('what to change, why, desired effect, and what to avoid');
    expect(prompt).toContain('fiction/writing prompts');
    expect(prompt).toContain('不要把她写成强行压住讨论的人');
    expect(prompt).toContain('Do not invent plot, setting, facts, files, character relationships');
  });

  it('parses optimized prompt tags', () => {
    const result = parseInstructionRefineResponse(
      '<instruction>删掉第3条，让白薇更松弛自然。</instruction>',
    );

    expect(result).toEqual({
      success: true,
      refinedInstruction: '删掉第3条，让白薇更松弛自然。',
    });
  });
});
