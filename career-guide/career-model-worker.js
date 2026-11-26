const model = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
let engine;

self.addEventListener('message', async ({ data }) => {
  const { id, kind } = data;
  try {
    if (kind === 'load') {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.89');
      engine = await CreateMLCEngine(model, {
        initProgressCallback: ({ progress }) => self.postMessage({ id, progress })
      });
      self.postMessage({ id });
      return;
    }
    if (kind !== 'prompt' || !engine) throw new Error('Model is not ready');
    const { instructions, input, schema } = data;
    const result = await engine.chat.completions.create({
      model,
      messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(input) }],
      response_format: { type: 'json_object', schema: JSON.stringify(schema) },
      temperature: 0.2,
      max_tokens: schema.properties.answer ? 280 : 40
    });
    self.postMessage({ id, result: JSON.parse(result.choices[0].message.content) });
  } catch {
    self.postMessage({ id, error: 'local-model' });
  }
});
