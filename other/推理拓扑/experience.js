/* exported createExperienceState, qualityPanel, runExperience */
// Local, deterministic responses demonstrate the side-by-side interaction only.
const defaultPrompt =
  "请用 TypeScript 实现一个请求去重函数：相同 key 的并发请求复用同一个 Promise，请求完成后清理缓存，并说明异常如何处理。";
const createExperienceState = () => ({
  prompt: defaultPrompt,
  running: false,
  outputs: null,
  progress: 0,
});
let experienceTimer = null;

function qualityPanel() {
  const experience = state.experience;
  return /* HTML */ `
    <section class="experience-panel">
      <div class="release-section-title">
        <h3>双版本体验</h3>
        <span class="muted small">同一道题，对照两版回答</span
        ><span class="tag spacer">本地演示</span>
      </div>
      <div class="experience-composer">
        <label for="experience-prompt">输入题目</label>
        <textarea
          id="experience-prompt"
          rows="3"
          maxlength="3000"
          placeholder="输入希望两版模型同时回答的问题…"
        >
${esc(experience.prompt)}</textarea>
        <div class="composer-footer">
          <span class="experience-note"
            >${icon("info")}相同输入与参数 · 示例输出，不发送真实请求</span
          ><button
            class="primary"
            data-action="run-experience"
            aria-busy="${experience.running}"
            ${experience.running ? "disabled" : ""}
          >
            ${experience.running ? '<span class="loading-dots" aria-label="正在生成"><i></i><i></i><i></i></span>' : `${icon("play")}${experience.outputs ? "重新对比" : "同时生成"}`}
          </button>
        </div>
        <div id="experience-error" class="error-message" role="alert"></div>
      </div>
      <div
        class="experience-results outputs"
        aria-live="polite"
        aria-busy="${experience.running}"
      >
        ${["old", "new"]
          .map(
            (version) => /* HTML */ `
              <article class="output ${version}">
                <div class="output-head">
                  <i class="dot ${version === "old" ? "blue" : "purple"}"></i
                  ><strong>${ver[version].name}</strong
                  ><span class="spacer muted small">${ver[version].id}</span>
                </div>
                <div class="output-model">${ver[version].model}</div>
                ${
                  experience.outputs
                    ? /* HTML */ `
                        <pre id="output-${version}">
${esc(experience.outputs[version].slice(0, experience.progress))}</pre>
                      `
                    : /* HTML */ `
                        <div class="output-empty">
                          ${icon("compare")}<span
                            >输入题目后，两版回答将在这里呈现</span
                          >
                        </div>
                      `
                }
                <div class="output-meta">
                  <span
                    >${experience.running ? "正在生成示例回答…" : experience.outputs ? "示例生成完成" : "等待输入"}</span
                  ><span
                    >${experience.outputs ? "业务效果待确认" : "相同输入 · 独立输出"}</span
                  >
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      <p class="experience-footer">
        请结合回答完整性、代码可用性与业务要求进行判断；生成结果不代表已通过测试。
      </p>
    </section>
  `;
}

function demoResponses(prompt) {
  if (/去重|Promise|并发/.test(prompt)) {
    return {
      old: [
        "可以用 Map 保存进行中的请求：",
        "",
        "const pending = new Map<string, Promise<unknown>>();",
        "",
        "function requestOnce<T>(key: string, run: () => Promise<T>) {",
        "  if (pending.has(key)) {",
        "    return pending.get(key) as Promise<T>;",
        "  }",
        "  const task = run().then(result => {",
        "    pending.delete(key);",
        "    return result;",
        "  });",
        "  pending.set(key, task);",
        "  return task;",
        "}",
        "",
        "相同 key 复用进行中的 Promise。成功后删除缓存；异常路径还需要补充清理逻辑。",
      ].join("\n"),
      new: [
        "使用 finally 统一清理，并将同步异常转为 Promise 拒绝：",
        "",
        "function createRequestOnce<T>() {",
        "  const pending = new Map<string, Promise<T>>();",
        "",
        "  return (key: string, run: () => Promise<T>): Promise<T> => {",
        "    const existing = pending.get(key);",
        "    if (existing) return existing;",
        "",
        "    const task = Promise.resolve().then(run).finally(() => {",
        "      pending.delete(key);",
        "    });",
        "    pending.set(key, task);",
        "    return task;",
        "  };",
        "}",
        "",
        "同一 key 的调用方复用同一个 Promise；成功或失败都会清理缓存，异常向调用方传播。一个实例处理同一类型的返回值，避免跨类型复用。",
      ].join("\n"),
    };
  }
  return {
    old: `关于「${prompt}」\n\n我的处理思路：\n1. 明确目标和输入。\n2. 按步骤给出方案。\n3. 检查结果是否满足要求。\n\n建议先实现主要流程，再补充异常处理。\n\n这是本地预设的体验示例，未调用模型。`,
    new: `关于「${prompt}」\n\n建议先确定验收条件，再组织实现：\n\n• 目标：明确预期结果和约束。\n• 实现：拆分核心步骤，保证接口和数据一致。\n• 边界：检查空输入、重复操作及失败恢复。\n• 验证：用相同输入比较结果，记录仍需人工判断的差异。\n\n这是本地预设的体验示例，未调用模型。`,
  };
}

function runExperience() {
  const experience = state.experience;
  if (experience.running) return;
  const prompt = $("experience-prompt").value.trim();
  if (!prompt) {
    $("experience-error").textContent = "请先输入一道题目。";
    $("experience-prompt").focus();
    return;
  }
  experience.prompt = prompt;
  experience.outputs = demoResponses(prompt);
  experience.progress = 0;
  experience.running = true;
  render();
  clearInterval(experienceTimer);
  const total = Math.max(
    ...Object.values(experience.outputs).map((output) => output.length),
  );
  experienceTimer = setInterval(() => {
    experience.progress = Math.min(total, experience.progress + 32);
    for (const version of ["old", "new"]) {
      const output = $("output-" + version);
      if (output)
        output.textContent = experience.outputs[version].slice(
          0,
          experience.progress,
        );
    }
    if (experience.progress === total) {
      clearInterval(experienceTimer);
      experience.running = false;
      if (state.view === "release" && state.tab === "quality") render();
    }
  }, 45);
}
