/* exported comparison, drawChart */
// Release views share one observation window and the same demonstration dataset.
const metricInfo = {
  failure: {
    title: "请求失败率",
    unit: "%",
    old: 0.2,
    new: 0.18,
    min: 0,
    max: 0.4,
    delta: "下降 0.02 个百分点",
  },
  timeout: {
    title: "请求超时率",
    unit: "%",
    old: 0.08,
    new: 0.06,
    min: 0,
    max: 0.16,
    delta: "下降 0.02 个百分点",
  },
  ttft: {
    title: "首 Token 时延 · TTFT P95",
    unit: "ms",
    old: 1000,
    new: 760,
    min: 400,
    max: 1400,
    delta: "降低 24%",
  },
  tpot: {
    title: "Token 间时延 · TPOT P95",
    unit: "ms/Token",
    old: 42,
    new: 34,
    min: 15,
    max: 65,
    delta: "降低 19%",
  },
};
const periods = {
  15: {
    label: "最近 15 分钟",
    start: "13:45",
    old: 45820,
    new: 10480,
    points: 21,
  },
  60: {
    label: "最近 1 小时",
    start: "13:00",
    old: 186040,
    new: 42860,
    points: 37,
  },
  180: {
    label: "最近 3 小时",
    start: "11:00",
    old: 421560,
    new: 95740,
    points: 49,
  },
  custom: {
    label: "自定义时间段",
    start: "13:00",
    old: 186040,
    new: 42860,
    points: 31,
  },
};

function windowLabel() {
  return state.period === "custom"
    ? state.customLabel
    : `${periods[state.period].start}–14:00`;
}
function windowMinutes() {
  return state.period === "custom"
    ? state.customEnd - state.customStart
    : Number(state.period);
}
function metricValues(key) {
  const factor =
    windowMinutes() <= 15 ? 0.98 : windowMinutes() >= 180 ? 1.03 : 1;
  return {
    old: metricInfo[key].old * factor,
    new: metricInfo[key].new * factor,
  };
}
function formatValue(value, key) {
  return ["failure", "timeout"].includes(key)
    ? value.toFixed(2)
    : Math.round(value).toLocaleString("en-US");
}

function observationWindow() {
  return /* HTML */ `
    <div class="observation-window">
      <span class="muted small">观察窗口</span>
      <div class="select-wrap">
        <button
          class="select-trigger"
          id="period"
          data-action="period-menu"
          aria-label="观察时间"
          aria-haspopup="listbox"
          aria-controls="period-menu"
          aria-expanded="false"
        >
          ${icon("clock")}<span>${periods[state.period].label}</span>${icon("down")}
        </button>
        <div
          class="select-menu"
          id="period-menu"
          popover
          role="listbox"
          aria-label="观察时间"
        >
          ${Object.entries(periods)
            .map(
              ([value, period]) => /* HTML */ `
                <button
                  class="select-option"
                  role="option"
                  data-action="period-option"
                  data-value="${value}"
                  aria-selected="${state.period === value}"
                >
                  ${period.label}${state.period === value ? icon("check") : ""}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <span class="muted small">10-21 · ${windowLabel()}</span>
    </div>
  `;
}

function releaseSummary() {
  const keyMode = state.mode === "key";
  const pending = count(state.targets, "none");
  const period = periods[state.period];
  const total = period.old + period.new;
  return /* HTML */ `
    <div class="release-summary-grid">
      <section class="scope-summary">
        <div class="release-section-title">
          <h3>当前试用范围</h3>
          <span class="scope-mode"
            >${keyMode ? "按 API Key 指定应用" : "按相对权重分流"}</span
          >
          <button class="link spacer" data-action="scope">
            查看${keyMode ? "应用分配" : "分流配置"}${icon("right")}
          </button>
        </div>
        <div class="table-scroll">
          <table class="release-scope-table">
            <thead>
              <tr>
                <th>部署版本</th>
                <th>${keyMode ? "分配 API Key" : "配置权重"}</th>
                <th>流量占比</th>
                <th>运行实例</th>
              </tr>
            </thead>
            <tbody>
              ${["old", "new"]
                .map(
                  (version) => /* HTML */ `
                    <tr>
                      <td>
                        <i
                          class="dot ${version === "old" ? "blue" : "purple"}"
                        ></i
                        >${ver[version].name}<span class="muted small">
                          · ${ver[version].id}</span
                        >
                      </td>
                      <td>
                        ${keyMode ? `${count(state.targets, version)} 个 Key` : state.weights[version]}
                      </td>
                      <td>${((period[version] / total) * 100).toFixed(1)}%</td>
                      <td>${state[version + "Running"] ? "2 / 2" : "0 / 2"}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p class="scope-caption">
          流量占比统计于当前观察窗口。${keyMode ? `同一 Key 的调用方属于同一试用范围。${pending ? `<span class="orange-text">${pending} 个 Key 尚未分配。</span>` : ""}` : "配置权重决定后续请求的预计份额。"}
        </p>
      </section>
      <aside class="release-facts">
        <h3>本次发布</h3>
        <dl>
          <div>
            <dt>开始时间</dt>
            <dd>10-21 11:42</dd>
          </div>
          <div>
            <dt>当前阶段</dt>
            <dd>${phaseText()}</dd>
          </div>
          <div>
            <dt>恢复快照</dt>
            <dd>灰度开始前 · 已保留</dd>
          </div>
          <div>
            <dt>服务地址</dt>
            <dd>保持不变</dd>
          </div>
        </dl>
      </aside>
    </div>
    <section class="release-observation">
      <div class="release-section-title observation-toolbar">
        <h3>灰度观察</h3>
        <div class="help-wrap">
          <button
            class="help-trigger"
            data-action="observation-help"
            aria-label="灰度观察说明"
            aria-expanded="false"
            aria-controls="observation-help"
          >
            ${icon("question")}
          </button>
          <div
            class="help-tooltip"
            id="observation-help"
            popover
            role="tooltip"
          >
            结合运行趋势和同一任务的输出结果判断是否继续放量；需要更多数据时，可保留当前试用范围继续观察。
          </div>
        </div>
        <span class="spacer"></span>${observationWindow()}
      </div>
      <div class="observe-grid">
        ${["failure", "ttft", "tpot"]
          .map((key) => {
            const metric = metricInfo[key];
            const values = metricValues(key);
            return /* HTML */ `
              <div class="observe-item">
                <div class="observe-label">
                  ${key === "failure" ? "请求失败率" : key === "ttft" ? "首 Token 时延 P95" : "Token 间时延 P95"}
                  <button
                    class="link"
                    data-action="compare"
                    data-tab="${key === "failure" ? "stability" : "performance"}"
                  >
                    查看${key === "failure" ? "稳定性" : "性能"}${icon("right")}
                  </button>
                </div>
                <div class="observe-values">
                  <span class="old-value"
                    >正式 ${formatValue(values.old, key)}</span
                  >${icon("arrowRight")}<b
                    >${formatValue(values.new, key)}
                    <span class="small">${metric.unit}</span></b
                  >
                </div>
                <div class="observe-detail">
                  <span class="delta">${metric.delta}</span> ·
                  ${key === "failure" ? `灰度 ${period.new.toLocaleString()} 次请求` : "两版同规格 · 2 实例 / 16 张卡"}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
    ${releaseInsight()}
  `;
}

function releaseInsight() {
  const brief = windowMinutes() < 30;
  const ended = state.phase !== "observing";
  const period = periods[state.period];
  const title = ended
    ? "本次灰度已结束"
    : brief
      ? "建议保持当前范围，继续观察"
      : "运行表现平稳，可分批扩大试用";
  const text = ended
    ? "本次观察结果已保留。请确认网关生效和在途请求状态，再安排部署资源。"
    : brief
      ? "当前窗口较短，灰度失败率与超时率未见明显升高。建议覆盖更多请求和业务高峰，再决定下一步。"
      : "灰度失败率低于正式版本，首 Token 时延降低 24%。建议先增加一组试点应用，结合双版本输出确认业务效果后再继续放量。";
  return /* HTML */ `
    <section class="release-insight" aria-label="灰度发布智能洞察">
      <div class="insight-icon">${icon("sparkles")}</div>
      <div class="insight-content">
        <div class="insight-heading">
          <h3>${title}</h3>
          <span class="tag purple">智能洞察 · 示例</span>
        </div>
        <p>${text}</p>
        <div class="insight-evidence">
          <span>${icon("clock")}${windowLabel()}</span
          ><span>灰度 ${period.new.toLocaleString()} 次请求</span
          ><span>${brief ? "建议延长观察窗口" : "资源相同 · 负载不同"}</span
          ><span>输出质量待业务确认</span>
        </div>
      </div>
      ${ended ? "" : `<button class="insight-action ${brief ? "" : "outline"}" data-action="${brief ? "compare" : "adjust"}" data-tab="stability">${brief ? "查看稳定性" : "调整试用范围"}${icon("right")}</button>`}
    </section>
  `;
}

function chartPanel(key) {
  const metric = metricInfo[key];
  const values = metricValues(key);
  return /* HTML */ `
    <section class="chart-frame">
      <div class="chart-top">
        <h3>${metric.title}</h3>
        <span class="muted small">越低越好</span>
      </div>
      <div class="chart-summary">
        <span class="chart-number old"
          ><small><i></i>正式版本</small><b>${formatValue(values.old, key)}</b
          ><span>${metric.unit}</span></span
        >
        <span class="chart-number new"
          ><small><i></i>灰度版本</small><b>${formatValue(values.new, key)}</b
          ><span>${metric.unit}</span></span
        >
        <span class="delta">${metric.delta}</span>
      </div>
      <canvas
        class="chart"
        data-chart="${key}"
        role="img"
        aria-label="${metric.title}趋势；正式 ${formatValue(values.old, key)}，灰度 ${formatValue(values.new, key)} ${metric.unit}，${metric.delta}"
      ></canvas>
      <div class="chart-foot">
        <span>窗口聚合值 · 示例趋势</span
        ><button class="link spacer" data-action="monitor">
          监控 / 日志${icon("right")}
        </button>
      </div>
    </section>
  `;
}
function metricPanel() {
  const stability = state.tab === "stability";
  const period = periods[state.period];
  return /* HTML */ `
    <div class="compare-filter">
      ${observationWindow()}<span class="spacer muted small"
        >请求量：正式 ${period.old.toLocaleString()} / 灰度
        ${period.new.toLocaleString()}</span
      ><button
        class="quiet square"
        data-action="refresh"
        aria-label="刷新对比数据"
      >
        ${icon("reload")}
      </button>
    </div>
    <div class="charts-grid">
      ${(stability ? ["failure", "timeout"] : ["ttft", "tpot"]).map(chartPanel).join("")}
    </div>
    <div class="context-note">
      ${icon("info")}<span
        >${stability ? "两版在相同窗口对照；请结合请求量与异常时段判断稳定性。" : "每版 2 实例 · Ascend 910B × 16；峰值并发：正式 128 / 灰度 32。资源相同、负载不同，差值不代表等负载基准测试结论。"}</span
      >
    </div>
  `;
}

const configRows = [
  [
    "模型",
    "模型名称 / 版本",
    "DeepSeek-V4.1-Flash / V001",
    "DeepSeek-V4.1-Flash-10.17 / V002",
    true,
  ],
  ["模型", "模型来源", "企业模型仓库", "企业模型仓库", false],
  ["引擎", "推理引擎", "wings-vllm:0.21.0", "wings-vllm:0.21.0", false],
  ["参数", "最大上下文长度", "65,536 Tokens", "65,536 Tokens", false],
  ["参数", "最大并发序列数", "128", "128", false],
  ["参数", "张量并行度 / 显存利用率", "8 / 0.90", "8 / 0.90", false],
  ["资源", "加速卡 / 实例", "Ascend 910B × 8", "Ascend 910B × 8", false],
  [
    "资源",
    "实例数 / CPU / 内存",
    "2 / 32 核 / 128 GiB",
    "2 / 32 核 / 128 GiB",
    false,
  ],
];
function configPanel() {
  const rows = configRows.filter((row) => !state.diff || row[4]);
  const groups = [...new Set(rows.map((row) => row[0]))];
  return /* HTML */ `
    <div class="compare-filter">
      <span
        >本次变更：<strong>模型版本升级</strong
        ><span class="muted small"> · 引擎、参数与资源保持一致</span></span
      ><label class="switch-label spacer"
        ><input
          type="checkbox"
          id="diff-only"
          ${state.diff ? "checked" : ""}
        />仅看差异</label
      >
    </div>
    <div class="config-columns">
      <span>配置项</span><span><i class="dot blue"></i>正式版本 · V001</span
      ><span><i class="dot purple"></i>灰度版本 · V002</span>
    </div>
    <div class="config-groups">
      ${groups
        .map(
          (group) => /* HTML */ `
            <section class="config-group">
              <div class="config-group-heading">
                <h3>${group}</h3>
                <small>${group === "模型" ? "1 项变更" : "配置一致"}</small>
              </div>
              <table class="compare-table">
                <tbody>
                  ${rows
                    .filter((row) => row[0] === group)
                    .map(
                      (row) => /* HTML */ `
                        <tr>
                          <th scope="row">${row[1]}</th>
                          <td>${row[2]}</td>
                          <td class="${row[4] ? "changed" : ""}">
                            ${row[3]}${row[4] ? '<span class="tag purple">已变更</span>' : ""}
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </section>
          `,
        )
        .join("")}
    </div>
    <div class="context-note">
      ${icon("info")}配置相同有助于理解性能变化；输出效果可在双版本体验中继续确认。
    </div>
  `;
}

function comparison() {
  const tabs = [
    ["summary", "发布概况"],
    ["stability", "稳定性对比"],
    ["performance", "性能对比"],
    ["quality", "输出质量"],
    ["config", "配置差异"],
  ];
  return /* HTML */ `
    <div class="release-context">
      ${["old", "new"]
        .map(
          (version, index) => /* HTML */ `
            ${index ? `<div class="context-direction">${icon("arrowRight")}</div>` : ""}
            <div class="release-version-context ${version}">
              <div class="version-context-top">
                <span class="context-label"
                  >${index ? "灰度目标" : "对照基线"}</span
                ><span class="tag ${index ? "purple" : ""}"
                  >${ver[version].name} · ${ver[version].id}</span
                ><span class="context-running"
                  ><i
                    class="dot ${state[version + "Running"] ? "" : "gray"}"
                  ></i
                  >${state[version + "Running"] ? "运行中" : "已停止"}</span
                >
              </div>
              <div class="context-model">
                ${icon("model")}<strong>${ver[version].model}</strong>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
    ${publishStrip()}
    <section class="panel release-body">
      <nav class="compare-tabs release-tabs" aria-label="灰度发布视图">
        ${tabs
          .map(
            ([value, label]) => /* HTML */ `
              <button
                class="${state.tab === value ? "active" : ""}"
                data-action="compare-tab"
                data-value="${value}"
                aria-current="${state.tab === value ? "page" : "false"}"
              >
                ${label}
              </button>
            `,
          )
          .join("")}
      </nav>
      <div id="compare-content">
        ${state.tab === "summary" ? releaseSummary() : state.tab === "config" ? configPanel() : state.tab === "quality" ? qualityPanel() : metricPanel()}
      </div>
    </section>
  `;
}

// Deterministic, aligned series: visible fluctuations with exact aggregate means.
function chartSeries(key, version) {
  const count = periods[state.period].points;
  const phase =
    (version === "old" ? 0.5 : 1.4) +
    { failure: 0, timeout: 2.1, ttft: 0.7, tpot: 1.6 }[key];
  const wave = Array.from(
    { length: count },
    (_, index) =>
      Math.sin(index * 0.83 + phase) * 0.13 +
      Math.sin(index * 1.94 + phase) * 0.055 +
      Math.cos(index * 0.37) * 0.075,
  );
  const mean = wave.reduce((sum, value) => sum + value, 0) / count;
  return wave.map((value) => metricValues(key)[version] * (1 + value - mean));
}
function drawChart() {
  document.querySelectorAll("canvas[data-chart]").forEach((canvas) => {
    const key = canvas.dataset.chart;
    const metric = metricInfo[key];
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const context = canvas.getContext("2d");
    context.scale(dpr, dpr);
    const pad = { left: 40, right: 14, top: 16, bottom: 29 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const bottom = pad.top + plotHeight;
    context.font = '10px "Microsoft YaHei", sans-serif';
    for (let index = 0; index <= 4; index++) {
      const y = pad.top + (plotHeight * index) / 4;
      context.strokeStyle = "#e9edf4";
      context.lineWidth = 1;
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(width - pad.right, y);
      context.stroke();
      context.fillStyle = "#7a879b";
      context.textAlign = "right";
      const value = metric.max - ((metric.max - metric.min) * index) / 4;
      context.fillText(
        metric.max < 1 ? value.toFixed(2) : Math.round(value),
        pad.left - 9,
        y + 3,
      );
    }
    context.setLineDash([]);
    const start =
      state.period === "custom"
        ? state.customStart
        : Number(periods[state.period].start.slice(0, 2)) * 60 +
          Number(periods[state.period].start.slice(3));
    const end = state.period === "custom" ? state.customEnd : 840;
    for (let index = 0; index <= 4; index++) {
      const time = Math.round(start + ((end - start) * index) / 4);
      context.fillStyle = "#7a879b";
      context.textAlign =
        index === 0 ? "left" : index === 4 ? "right" : "center";
      context.fillText(
        `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`,
        pad.left + (plotWidth * index) / 4,
        height - 8,
      );
    }
    for (const version of ["old", "new"]) {
      const points = chartSeries(key, version).map((value, index, values) => ({
        x: pad.left + (plotWidth * index) / (values.length - 1),
        y:
          pad.top +
          plotHeight * (1 - (value - metric.min) / (metric.max - metric.min)),
      }));
      const path = new Path2D();
      path.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1];
        const point = points[index];
        const midpoint = (previous.x + point.x) / 2;
        path.bezierCurveTo(
          midpoint,
          previous.y,
          midpoint,
          point.y,
          point.x,
          point.y,
        );
      }
      const area = new Path2D(path);
      area.lineTo(points.at(-1).x, bottom);
      area.lineTo(points[0].x, bottom);
      area.closePath();
      const gradient = context.createLinearGradient(0, pad.top, 0, bottom);
      gradient.addColorStop(
        0,
        version === "old" ? "rgba(45,76,245,0.16)" : "rgba(132,93,225,0.16)",
      );
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fill(area);
      context.strokeStyle = ver[version].color;
      context.lineWidth = 2.2;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.stroke(path);
    }
  });
}
