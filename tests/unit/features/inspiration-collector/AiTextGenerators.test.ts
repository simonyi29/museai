import { AuxRunnerAiTextGenerator } from '@/features/inspiration-collector/AiTextGenerators';

describe('AuxRunnerAiTextGenerator', () => {
  it('runs an auxiliary query with the report system prompt and resets the runner', async () => {
    const runner = {
      query: jest.fn().mockResolvedValue('# report'),
      reset: jest.fn(),
    };
    const generator = new AuxRunnerAiTextGenerator(runner, () => 'model-a');

    const result = await generator.generate({
      systemPrompt: 'system',
      prompt: 'prompt',
    });

    expect(result).toBe('# report');
    expect(runner.query).toHaveBeenCalledWith({
      abortController: expect.any(AbortController),
      model: 'model-a',
      systemPrompt: 'system',
    }, 'prompt');
    expect(runner.reset).toHaveBeenCalledTimes(1);
  });

  it('resets the runner after query failures', async () => {
    const runner = {
      query: jest.fn().mockRejectedValue(new Error('failed')),
      reset: jest.fn(),
    };
    const generator = new AuxRunnerAiTextGenerator(runner);

    await expect(generator.generate({
      systemPrompt: 'system',
      prompt: 'prompt',
    })).rejects.toThrow('failed');
    expect(runner.reset).toHaveBeenCalledTimes(1);
  });
});
