import type { AuxQueryRunner } from '../../core/auxiliary/AuxQueryRunner';
import type { AiTextGenerator } from './types';

export class AuxRunnerAiTextGenerator implements AiTextGenerator {
  constructor(
    private readonly runner: AuxQueryRunner,
    private readonly resolveModel?: () => string | undefined,
  ) {}

  async generate(input: { systemPrompt: string; prompt: string }): Promise<string> {
    const abortController = new AbortController();
    try {
      return await this.runner.query({
        abortController,
        model: this.resolveModel?.(),
        systemPrompt: input.systemPrompt,
      }, input.prompt);
    } finally {
      this.runner.reset();
    }
  }
}
