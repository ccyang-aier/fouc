/* exported createExperienceState, qualityPanel, runExperience, experiencePrompts */
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

const experiencePrompts = [
  { label: "随机超长文本", create: randomLongPrompt },
  {
    label: "工具调用校验",
    text: "请用 TypeScript 设计工具调用参数校验逻辑：校验必填字段与未知参数，并给出可读的错误信息。",
  },
];

// A realistic long-input fixture; regenerate the content on every click.
function randomLongPrompt() {
  const topics = [
    "跨团队灰度发布",
    "企业知识检索",
    "长上下文推理",
    "在线服务升级",
    "多版本体验评估",
  ];
  const observations = [
    "正式版本持续承担日常业务请求，新版本只面向经过授权的试点调用方。需要在相同观察窗口内，对齐请求失败率、超时率、首 Token 时延与输出效果，分别记录稳定性变化和业务可用性。",
    "业务团队反馈同一个问题在不同上下文中可能得到不同回答，因此评估必须保留任务背景、输入材料和验收条件。请区分已有事实、合理推断与尚未验证的结论，不将单次成功作为完整质量证明。",
    "实际请求包含简短查询、多轮问答、结构化提取和复杂代码生成，输入规模与并发负载存在差异。比较结果时应注明资源条件，避免把负载差异直接解释为模型能力提升。",
    "观察期内需要保留原有服务入口和授权边界。调整试用范围前应展示具体影响对象，完成发布或退出灰度后继续检查网关生效状态，在途流式请求由原版本处理，不直接释放仍有请求的部署资源。",
    "请整理材料中的重复表述、相互矛盾的信息和缺失的约束，给出清晰、可执行的下一步建议。结论应说明依据、影响范围和仍需人工确认的问题，避免输出没有信息价值的套话。",
    "团队希望界面支持长文本阅读、并排对照和连续修改输入。段落与列表需要保持合理间距，长名称和代码块不应破坏布局，输入过程中应保留焦点，错误提示应直接指向可以修正的问题。",
  ];
  const choose = (items) => items[Math.floor(Math.random() * items.length)];
  const sections = Array.from({ length: 48 }, (_, index) => {
    const reference = Math.floor(10000 + Math.random() * 90000);
    return `材料 ${index + 1} · 记录 ${reference}\n${choose(observations)}${choose(observations)}`;
  });
  return `请分析以下关于「${choose(topics)}」的长篇材料，提炼主要结论、关键分歧和执行建议。\n\n${sections.join("\n\n")}\n\n请用简明的分组结构回答，并列出仍需补充的信息。`;
}

function qualityPanel() {
  const experience = state.experience;
  return /* HTML */ `
    <section class="quality-studio">
      <div class="quality-workbench">
        <div class="quality-comparison" aria-busy="${experience.running}">
          ${["old", "new"]
            .map(
              (version) => /* HTML */ `
                <article class="quality-lane ${version}">
                  <header class="quality-lane-header">
                    <div class="quality-version">
                      <i class="quality-version-dot" aria-hidden="true"></i
                      ><strong>${ver[version].name}</strong
                      ><span>${ver[version].id}</span>
                    </div>
                    <span class="quality-result-state"
                      >${experience.running ? "生成中…" : ""}</span
                    >
                  </header>
                  ${
                    experience.outputs
                      ? /* HTML */ `
                          <div class="quality-response" id="output-${version}">
                            ${formatResponse(experience.outputs[version].slice(0, experience.progress))}
                          </div>
                        `
                      : /* HTML */ `
                          <div class="quality-empty">
                            <p>等待回答</p>
                          </div>
                        `
                  }
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="quality-composer">
          <label class="sr-only" for="experience-prompt">输入题目</label>
          <textarea
            id="experience-prompt"
            rows="2"
            maxlength="20000"
            placeholder="输入一个问题，同时向两个版本提问…"
          >
${esc(experience.prompt)}</textarea>
          <div class="quality-composer-tools">
            <div class="quality-prompt-ideas">
              <span>试试</span
              >${experiencePrompts.map((prompt, index) => /* HTML */ `<button data-action="experience-preset" data-prompt="${index}">${prompt.label}</button>`).join("")}
            </div>
            <button
              class="primary quality-send"
              data-action="run-experience"
              aria-label="同时生成两个版本回答"
              aria-busy="${experience.running}"
              ${experience.running ? "disabled" : ""}
            >
              <span class="quality-send-content"
                >${icon("arrowRight")}${experience.outputs ? "重新对比" : "同时生成"}</span
              >
              ${experience.running ? '<span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>' : ""}
            </button>
          </div>
          <div id="experience-error" class="error-message" role="alert"></div>
        </div>
      </div>
      <footer class="quality-footnote">
        <span>${icon("info")}相同输入与参数 · 本地示例输出</span
        ><span
          >${experience.running ? "两版正在生成回答…" : experience.outputs ? "回答已生成，业务效果待确认" : "输入问题后开始对比"}</span
        >
      </footer>
    </section>
  `;
}

function formatResponse(text) {
  return text
    .split("```")
    .map((part, index) => {
      if (index % 2)
        return `<pre><code>${esc(part.replace(/^typescript\n/, "").trim())}</code></pre>`;
      return part
        .trim()
        .split(/\n\n+/)
        .filter(Boolean)
        .map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`)
        .join("");
    })
    .join("");
}

function demoResponses(prompt) {
  if (/去重|Promise/.test(prompt)) {
    return {
      old: [
        "可以用 Map 保存进行中的请求：",
        "",
        "```typescript",
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
        "```",
        "相同 key 复用进行中的 Promise。成功后删除缓存；异常路径还需要补充清理逻辑。",
      ].join("\n"),
      new: [
        "使用 finally 统一清理，并将同步异常转为 Promise 拒绝：",
        "",
        "```typescript",
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
        "```",
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
  const step = Math.max(32, Math.ceil(total / 40));
  experienceTimer = setInterval(() => {
    experience.progress = Math.min(total, experience.progress + step);
    for (const version of ["old", "new"]) {
      const output = $("output-" + version);
      if (output)
        output.innerHTML = formatResponse(
          experience.outputs[version].slice(0, experience.progress),
        );
    }
    if (experience.progress === total) {
      clearInterval(experienceTimer);
      experience.running = false;
      if (state.view === "release" && state.tab === "quality") render();
    }
  }, 45);
}
