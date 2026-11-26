let extractor;
const examples = {
  resume: 'Как составить резюме и описать учебный проект и опыт работы',
  search: 'Как искать подходящие вакансии и выбрать условия работы',
  compare: 'Как сравнить профессии и выбрать между разными вакансиями',
  interview: 'Как подготовиться к собеседованию и рассказать о себе работодателю',
  practice: 'Как выучить новые навыки и получить практический опыт'
};

self.addEventListener('message', async ({ data }) => {
  const { id, kind } = data;
  try {
    if (kind === 'load') {
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;
      extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', {
        device: 'wasm', dtype: 'q8',
        progress_callback: info => {
          if (info.status === 'progress' && info.file?.endsWith('.onnx')) {
            self.postMessage({ id, progress: info.progress / 100 });
          }
        }
      });
      self.postMessage({ id });
      return;
    }
    if (kind !== 'prompt' || !extractor) throw new Error('Model is not ready');
    const steps = data.schema.properties.step.enum;
    const query = Object.values(data.input).join('. ').slice(0, 1200);
    const output = await extractor([query, ...steps.map(step => examples[step])], { pooling: 'mean', normalize: true });
    const vectors = output.tolist();
    let best = steps[0];
    let bestScore = -Infinity;
    for (let i = 0; i < steps.length; i++) {
      const score = vectors[0].reduce((sum, value, index) => sum + value * vectors[i + 1][index], 0);
      if (score > bestScore) { bestScore = score; best = steps[i]; }
    }
    self.postMessage({ id, result: { step: best } });
  } catch {
    self.postMessage({ id, error: 'local-model' });
  }
});
