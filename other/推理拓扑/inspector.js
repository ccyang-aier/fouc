/* exported renderInspector, configList, steps */
"use strict";

// Selected-object diagnostics, metrics, configuration and physical resources.
const event = (time, title, text, type = "") =>
  /* HTML */ `<div class="event ${type}">
    <time>${time}</time>
    <div>
      <strong>${title}</strong>
      <p>${text}</p>
    </div>
  </div>`;
function configList(extra = "") {
  return /* HTML */ `<dl class="config-list">
    <dt>模型名称</dt>
    <dd>Qwen3-32B</dd>
    <dt>推理框架</dt>
    <dd>vLLM 0.9.1</dd>
    <dt>并行配置</dt>
    <dd>TP = 4${state.mode === "pd" ? " · P/D 分离" : ""}</dd>
    <dt>卡组规格</dt>
    <dd>4 × Ascend 910B</dd>
    ${extra}
  </dl>`;
}
function steps() {
  return /* HTML */ `<div class="progress-steps">
    ${["资源准备", "模型加载", "运行就绪", "实际接流"]
      .map(
        (t, i) =>
          /* HTML */ `<div
            class="step ${state.progress > i ? "done" : state.progress === i ? "current" : ""}"
          >
            ${t}
          </div>`,
      )
      .join("")}
  </div>`;
}
function chart(name, color = "var(--signal)") {
  return /* HTML */ `<div class="detail-chart">
    <h3>${name}<span>最近${state.period === "15" ? "15分钟" : "1小时"}</span></h3>
    <svg viewBox="0 0 300 105" aria-label="${name} 演示趋势图">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity=".25" />
          <stop offset="1" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M25 17H294M25 43H294M25 69H294" stroke="var(--line)" stroke-dasharray="3 5" />
      <text class="chart-axis" x="0" y="20">1.5k</text>
      <text class="chart-axis" x="4" y="46">750</text>
      <text class="chart-axis" x="16" y="72">0</text>
      <path
        d="M25 68 45 66 65 61 85 64 105 57 125 60 145 45 165 49 185 30 205 34 225 ${state.verified
          ? 54
          : 24} 245 ${state.verified ? 56 : 30} 270 ${state.verified ? 55 : 18} 294 ${state.verified
          ? 54
          : 23}V77H25Z"
        fill="url(#chart-fill)"
      />
      <path
        d="M25 68 45 66 65 61 85 64 105 57 125 60 145 45 165 49 185 30 205 34 225 ${state.verified
          ? 54
          : 24} 245 ${state.verified ? 56 : 30} 270 ${state.verified ? 55 : 18} 294 ${state.verified
          ? 54
          : 23}"
        fill="none"
        stroke="${color}"
        stroke-width="1.8"
      />
      <text class="chart-axis" x="25" y="100">14:15</text>
      <text class="chart-axis" x="148" y="100">14:22</text>
      <text class="chart-axis" x="264" y="100">14:30</text>
    </svg>
  </div>`;
}
function diagnostic(title, text, type = "error") {
  return /* HTML */ `<div
    class="diagnostic-card ${type === "good" ? "healthy" : type === "warn" ? "pressure" : ""}"
  >
    <span class="diagnostic-icon"
      >${icon(type === "good" ? "Check" : type === "info" ? "Clock" : "CircleAlert")}</span
    >
    <div>
      <strong>${title}</strong>
      <p>${text}</p>
    </div>
  </div>`;
}
function configPanel(extra = "") {
  return /* HTML */ `<section class="detail-section">
    <h3>配置信息</h3>
    <div class="panel-box">${configList(extra)}</div>
  </section>`;
}
function renderInspector() {
  const id = state.selected,
    r = instances().find((x) => x.id === id),
    resource = /^[ng]/.test(id),
    host = resource ? instances().find((x) => x.id === "i" + id[1]) : null,
    archived = id === "archive",
    tab = state.detailTab;
  let title = "",
    status = "",
    type = "",
    subtitle = "",
    content = "",
    avatar = "instance";
  const configExtra = /* HTML */ `<dt>所属节点</dt>
    <dd>${archived ? "node-03（原位置）" : r?.host || "正式版本"}</dd>`;
  if (r || archived) {
    const stopped = archived || r.id === "i3",
      building = r?.building,
      isolated = state.isolated.includes(id);
    title = archived ? "实例-03 · 已清理" : r.name;
    status = archived
      ? "配置已保留"
      : stopped
        ? "异常停止"
        : building
          ? ["资源准备", "模型加载", "等待就绪", "运行就绪"][state.progress]
          : isolated
            ? "流量隔离"
            : r.load > 80
              ? "高负载"
              : "运行中";
    type = archived
      ? "gray"
      : stopped
        ? "bad"
        : building
          ? "blue"
          : isolated
            ? "gray"
            : r.load > 80
              ? "warn"
              : "";
    subtitle = `AI-Coding / 正式版本${r?.role ? " / " + r.role : ""}`;
    if (tab === "config") {
      content = /* HTML */ `<section class="detail-section">
          <h3>${archived ? "清理前配置快照" : "当前实例配置"}</h3>
          <div class="panel-box">
            ${configList(
              configExtra +
                /* HTML */ `<dt>启动参数</dt>
                  <dd class="mono">
                    --tensor-parallel-size 4<br />--max-model-len 32768<br />--gpu-memory-utilization
                    0.90
                  </dd>
                  <dt>配置来源</dt>
                  <dd>${r?.id === "i4" ? state.copySource : "部署模板 v1.2.0"}</dd>`,
            )}
          </div>
        </section>
        <div class="suggestion">
          ${icon("Copy")}
          <div>
            <b>配置复用，资源重新绑定</b
            >复用模型、引擎、启动参数和资源规格；新位置与设备绑定在提交时重新校验。
          </div>
        </div>`;
    } else if (tab === "events") {
      content = /* HTML */ `<section class="detail-section">
          <h3>对象事件<small>同一观察时段</small></h3>
          <div class="timeline">
            ${stopped
              ? event(
                  "14:26:18",
                  "进程退出 · ExitCode 137",
                  "容器 Terminated，退出原因需结合日志确认。",
                ) +
                event("14:25:57", "显存使用率 98%", "停止前出现资源压力。", "warning") +
                event("14:25:51", "就绪探测失败", "请求连接被拒绝。", "warning")
              : event(
                  "14:30:12",
                  building ? "补建执行中" : "观测到实际请求",
                  building ? "等待模型加载、就绪与接流。" : "成功请求与输出 Token 已关联当前实例。",
                  "success",
                ) + event("14:29:42", "运行就绪", "就绪探测已通过。", "success")}
          </div>
        </section>
        <section class="detail-section">
          <h3>关联日志<small>${archived ? "实例-03" : r.name}</small></h3>
          <pre class="log">
${stopped
              ? "14:26:18 container terminated\nexitCode=137 reason=Error\n14:25:57 accelerator_memory=98%\n14:25:51 readiness=failed"
              : "14:30:12 requests_total += 1\n14:30:12 output_tokens += 128\n14:29:42 readiness=passed"}</pre
          >
        </section>
        <p class="quiet">日志、事件与监控沿用当前对象和观察时段。</p>`;
    } else if (tab === "metrics") {
      content = stopped
        ? /* HTML */ `${diagnostic(
              "无当前性能样本",
              "实例已停止，14:26 后无接流；不以零时延代替缺失样本。",
            )}
            <div class="data-pairs">
              <p>
                停止前显存使用率<strong class="warn">98<small>%</small></strong>
              </p>
              <p>停止前在途请求<strong>12</strong></p>
            </div>
            ${chart("停止前首响应 P95", "var(--amber)")}
            <p class="quiet">停止前观测时间 14:25。当前请求、时延与输出均无有效样本。</p>`
        : /* HTML */ `${building ? steps() : ""}
            <div class="data-pairs">
              <p>
                实际请求<strong>${building || isolated ? "—" : r.qps}<small>req/s</small></strong>
              </p>
              <p>
                首响应 P95<strong>${r.ttft === null ? "—" : r.ttft}<small>ms</small></strong>
              </p>
              <p>
                输出速率<strong
                  >${building || isolated ? "—" : r.id === "i4" ? "428" : "2,480"}<small
                    >tokens/s</small
                  ></strong
                >
              </p>
              <p>在途请求<strong>${building || isolated ? "0" : "8"}</strong></p>
            </div>
            ${chart("首响应时延 P95", r.load > 80 ? "var(--amber)" : "var(--signal)")}`;
    } else if (archived) {
      content = /* HTML */ `${diagnostic(
          "异常实例已清理",
          "模型、引擎、启动参数和资源规格已随任务保存。",
          "good",
        )}
        <div class="suggestion">
          ${icon("Copy")}
          <div>
            <b>从配置快照继续补建</b
            >在右上角“更多操作”或变更任务中选择同配置新建，加入原部署并沿用服务入口。
          </div>
        </div>
        ${configPanel(
          /* HTML */ `<dt>原实例</dt>
            <dd>实例-03 / node-03</dd>`,
        )}<button class="read-link" data-action="show-records">
          ${icon("ClipboardList")}查看本次变更任务
        </button>`;
    } else if (stopped) {
      content = /* HTML */ `${diagnostic(
          "进程异常退出 / 当前未接流",
          "当前实例已从接流中摘除，剩余实例继续承载请求。",
        )}
        <div class="condition-grid">
          <div class="condition">
            ${icon("X")}
            <div><span>就绪检查</span><strong class="bad">未通过</strong></div>
          </div>
          <div class="condition">
            ${icon("Clock")}
            <div><span>接流状态</span><strong class="warn">已摘流</strong></div>
          </div>
        </div>
        <section class="detail-section">
          <h3>事件时间线</h3>
          <div class="timeline">
            ${event("14:26", "进程退出　ExitCode 137", "当前证据尚不足以确认根因。")}${event(
              "14:25",
              "显存使用率 98%",
              "停止前压力升高，需结合日志核查。",
              "warning",
            )}
          </div>
        </section>
        <div class="suggestion">
          ${icon("Lightbulb")}
          <div><b>处理建议</b>先查看退出日志核对原因，再保留配置并替换异常实例。</div>
        </div>
        ${configPanel(configExtra)}`;
    } else if (building) {
      content = /* HTML */ `${diagnostic(
          state.progress >= 3 ? "运行就绪 / 等待接流" : "实例补建中",
          state.progress >= 3
            ? "就绪检查已通过，尚未观测到实际请求。"
            : "暂不分发请求，其他实例持续承载业务。",
          state.progress >= 3 ? "good" : "info",
        )}
        <section class="detail-section">
          <h3>补建进展</h3>
          <div class="panel-box">
            ${steps()}
            <p class="quiet">
              ${[
                "正在准备 node-04 的 4 张 Ascend 910B。",
                "资源准备完成，正在加载模型。",
                "模型加载完成，等待就绪检查。",
                "已运行就绪，继续确认实际请求与输出。",
              ][state.progress]}
            </p>
          </div>
        </section>
        ${configPanel(
          /* HTML */ `<dt>新位置</dt><dd>node-04 / NPU 0–3</dd><dt>配置来源</dt><dd>` +
            state.copySource +
            /* HTML */ `</dd>`,
        )}`;
    } else {
      content = /* HTML */ `${diagnostic(
          isolated ? "流量已隔离" : r.load > 80 ? "运行中 / 性能压力较高" : "运行就绪 / 已实际接流",
          isolated
            ? "新请求已暂停，在途请求已排空；保留实例继续排查。"
            : r.load > 80
              ? "运行状态正常，但负载和首响应时延需要关注。"
              : "观测到成功请求及连续 Token 输出。",
          isolated ? "info" : r.load > 80 ? "warn" : "good",
        )}
        <div class="data-pairs">
          <p>
            实际请求<strong>${isolated ? "0" : r.qps}<small>req/s</small></strong>
          </p>
          <p>
            首响应 P95<strong>${r.ttft}<small>ms</small></strong>
          </p>
        </div>
        ${chart("首响应时延 P95", r.load > 80 ? "var(--amber)" : "var(--signal)")}
        <section class="detail-section">
          <h3>承载资源</h3>
          <div class="panel-box">
            <dl class="config-list">
              <dt>物理节点</dt>
              <dd>${r.host} / ${r.ip}</dd>
              <dt>加速卡组</dt>
              <dd>Ascend 910B · NPU 0–3</dd>
              <dt>当前在途</dt>
              <dd>${isolated ? "0" : "8"} 个请求</dd>
              <dt>实例负载</dt>
              <dd>${r.load}%</dd>
            </dl>
          </div>
        </section>`;
    }
  } else if (resource && host) {
    const gpu = id.startsWith("g"),
      slot = gpu ? Number(id.split("-")[1]) : -1,
      load = gpu ? Math.max(0, host.load - ([5, 1, 9, 4, 12, 7, 16, 11][slot] || 0)) : host.load;
    avatar = gpu ? "gpu" : "node";
    title = gpu ? `${host.host} · NPU${slot}` : host.host;
    status = "资源健康";
    subtitle = `${host.ip} / Ascend 910B`;
    const workload =
      host.id === "i3"
        ? "原实例已停止，当前无绑定"
        : gpu && slot >= 4
          ? "其他工作负载 · 非本服务"
          : host.name + " / 正式版本";
    if (tab === "config") {
      content = /* HTML */ `<section class="detail-section">
          <h3>物理资源配置</h3>
          <div class="panel-box">
            <dl class="config-list">
              <dt>节点</dt>
              <dd>${host.host}</dd>
              <dt>IP</dt>
              <dd>${host.ip}</dd>
              <dt>服务器型号</dt>
              <dd>KunLun G5680 V2</dd>
              <dt>卡类型</dt>
              <dd>Ascend 910B / 64 GiB</dd>
              <dt>物理卡数</dt>
              <dd>8</dd>
              <dt>当前关联</dt>
              <dd>${workload}</dd>
            </dl>
          </div>
        </section>
        ${hardware(host, slot)}`;
    } else if (tab === "events") {
      content = /* HTML */ `${diagnostic("资源健康正常", "所选时段无硬件健康告警。", "good")}
        <section class="detail-section">
          <h3>资源事件</h3>
          <div class="timeline">
            ${event("14:28", "资源采集正常", "设备状态与实例运行状态分别观测。", "success")}${event(
              "14:25",
              "关联负载变化",
              host.id === "i3" ? "原实例停止后，原卡组绑定释放。" : "关联实例持续承载服务请求。",
              "warning",
            )}
          </div>
        </section>`;
    } else {
      content = /* HTML */ `${diagnostic(
          "资源健康正常",
          gpu && slot >= 4
            ? "当前设备属于其他工作负载，未绑定本服务实例。"
            : host.load > 80
              ? "关联实例负载较高，资源健康与性能压力分别判断。"
              : "所选物理资源与关联实例已在拓扑中联动。",
          "good",
        )}
        <div class="data-pairs">
          <p>
            ${gpu ? "算力使用率" : "CPU 使用"}<strong
              >${gpu ? load : "16 / 64"}<small>${gpu ? "%" : "核"}</small></strong
            >
          </p>
          <p>
            ${gpu ? "显存使用" : "内存使用"}<strong
              >${gpu ? "48.6 / 64" : "138 / 512"}<small>GiB</small></strong
            >
          </p>
        </div>
        <section class="detail-section">
          <h3>GPU 槽位示意<small>KunLun G5680 V2</small></h3>
          <div class="panel-box" style="padding:5px 9px 10px">
            ${hardware(host, slot)}
            <div class="slot-view">
              ${Array.from(
                { length: 8 },
                (_, n) =>
                  /* HTML */ `<button
                    class="big-slot ${n < 4 && host.id !== "i3" ? "mine" : ""}${n === slot
                      ? " chosen"
                      : ""}"
                    data-select="g${id[1]}-${n}"
                  >
                    NPU ${n}
                  </button>`,
              ).join("")}
            </div>
            <p class="quiet" style="margin-top:9px">强调色：本实例卡组　灰色：其他负载 / 无绑定</p>
          </div>
        </section>
        <div class="resource-bar">
          <span>算力使用 / 本服务分配</span
          ><b>${load}% / ${host.id === "i3" || (gpu && slot >= 4) ? "0" : gpu ? "100" : "50"}%</b
          ><span class="meter ${host.load > 80 ? "warn" : ""}"><i style="width:${load}%"></i></span>
        </div>
        <section class="detail-section">
          <h3>关联工作负载</h3>
          ${(gpu && slot >= 4) || host.id === "i3"
            ? /* HTML */ `<p class="quiet">` + workload + /* HTML */ `</p>`
            : /* HTML */ `<button class="read-link" data-select="${host.id}">
                ${icon("Network")}${workload}
              </button>`}
        </section>`;
    }
  } else {
    avatar = "model";
    title = id === "deployment" ? "正式版本 · v1.2.0" : "AI-Coding";
    status = state.verified && state.cleared ? "运行正常" : "容量关注";
    type = state.verified && state.cleared ? "" : "warn";
    subtitle = `Qwen3-32B / ${state.mode === "pd" ? "P/D 分离" : "标准推理"}`;
    content =
      tab === "config"
        ? configPanel(
            /* HTML */ `<dt>调用入口</dt>
              <dd class="mono">/v1/chat/completions</dd>
              <dt>期望实例数</dt>
              <dd>3</dd>
              <dt>部署版本</dt>
              <dd>v1.2.0 / 正式版本</dd>`,
          )
        : tab === "events"
          ? /* HTML */ `<section class="detail-section">
              <h3>服务事件</h3>
              <div class="timeline">
                ${event(
                  "14:26",
                  "接流实例从 3 降至 2",
                  "实例-03 异常停止，剩余实例承载压力升高。",
                  "warning",
                )}${event("14:25", "服务首响应时延上升", "P95 达到 1,280 ms。", "warning")}
              </div>
            </section>`
          : /* HTML */ `<div class="data-pairs">
                <p>
                  服务请求<strong>24.8<small>req/s</small></strong>
                </p>
                <p>
                  接流实例<strong
                    >${2 - state.isolated.length + (state.progress === 4 ? 1 : 0)}<small
                      >/ 目标 3</small
                    ></strong
                  >
                </p>
              </div>
              ${chart("服务首响应时延 P95")}
              <section class="detail-section">
                <h3>请求与容量</h3>
                <div class="panel-box">
                  <dl class="config-list">
                    <dt>等待队列</dt>
                    <dd>${state.verified ? "2" : "38"} 个请求</dd>
                    <dt>失败率</dt>
                    <dd>${state.verified ? "0.02" : "1.4"}%</dd>
                    <dt>输出吞吐</dt>
                    <dd>${state.verified ? "7,520" : "4,960"} tokens/s</dd>
                  </dl>
                </div>
              </section>
              <section class="detail-section">
                <h3>加速效能<small>所选时段</small></h3>
                <div class="accel-cards">
                  <button data-action="cache">
                    ${icon("Zap")}<span>SmartKVCache</span><b>62<small>%</small></b
                    ><span>Token 复用率</span></button
                  ><button data-action="decoding">
                    ${icon("Activity")}<span>SmartDecoding</span><b>74<small>%</small></b
                    ><span>草稿接受率</span>
                  </button>
                </div>
              </section>`;
  }
  const tabs = [
    ["diagnosis", "诊断"],
    ["metrics", "监控"],
    ["config", "配置"],
    ["events", "事件"],
  ];
  $("inspector").innerHTML = /* HTML */ `<div class="inspector-head">
      <div class="inspector-identity">
        <span class="object-avatar"
          >${icon({ instance: "Layers", node: "Server", gpu: "Cpu", model: "Box" }[avatar])}</span
        >
        <div class="object-heading">
          <div class="object-title">
            <h2>${title}</h2>
            ${tag(status, type)}
          </div>
          <p class="object-subtitle">${subtitle}</p>
        </div>
        <div class="inspector-tools">
          <button
            data-action="object-menu"
            data-value="${id}"
            aria-label="所选对象更多操作"
            aria-haspopup="menu"
            title="更多操作"
          >
            ${icon("Ellipsis")}</button
          ><button data-action="hide-inspector" aria-label="收起对象详情">${icon("X")}</button>
        </div>
      </div>
      <div class="object-tabs" role="tablist" aria-label="对象详情">
        ${tabs
          .map(
            ([value, label]) =>
              /* HTML */ `<button
                class="${tab === value ? "active" : ""}"
                role="tab"
                aria-selected="${tab === value}"
                data-action="detail-tab"
                data-value="${value}"
              >
                ${label}
              </button>`,
          )
          .join("")}
      </div>
    </div>
    <div class="inspector-content" role="tabpanel">${content}</div>`;
}
