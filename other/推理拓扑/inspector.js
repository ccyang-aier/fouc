/* exported renderInspector, configList, steps */
"use strict";

// Selected-object monitoring, configuration, events and physical resources.
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
            class="step ${state.progress > i
              ? "done"
              : state.progress === i
                ? "current"
                : ""}"
          >
            ${t}
          </div>`,
      )
      .join("")}
  </div>`;
}
function chart(name, color = "var(--signal)") {
  return /* HTML */ `<div class="detail-chart">
    <h3>
      ${name}<span>最近${state.period === "15" ? "15分钟" : "1小时"}</span>
    </h3>
    <svg viewBox="0 0 300 105" aria-label="${name} 演示趋势图">
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity=".25" />
          <stop offset="1" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M25 17H294M25 43H294M25 69H294"
        stroke="var(--line)"
        stroke-dasharray="3 5"
      />
      <text class="chart-axis" x="0" y="20">1.5k</text>
      <text class="chart-axis" x="4" y="46">750</text>
      <text class="chart-axis" x="16" y="72">0</text>
      <path
        d="M25 68 45 66 65 61 85 64 105 57 125 60 145 45 165 49 185 30 205 34 225 ${state.verified
          ? 54
          : 24} 245 ${state.verified ? 56 : 30} 270 ${state.verified
          ? 55
          : 18} 294 ${state.verified ? 54 : 23}V77H25Z"
        fill="url(#chart-fill)"
      />
      <path
        d="M25 68 45 66 65 61 85 64 105 57 125 60 145 45 165 49 185 30 205 34 225 ${state.verified
          ? 54
          : 24} 245 ${state.verified ? 56 : 30} 270 ${state.verified
          ? 55
          : 18} 294 ${state.verified ? 54 : 23}"
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
function statusNotice(title, text, type = "error") {
  return /* HTML */ `<div
    class="diagnostic-card ${type === "good"
      ? "healthy"
      : type === "warn"
        ? "pressure"
        : type === "info"
          ? "informational"
          : ""}"
  >
    <span class="diagnostic-icon"
      >${icon(
        type === "good" ? "Check" : type === "info" ? "Clock" : "CircleAlert",
      )}</span
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

function instanceMonitoring(row, archived) {
  if (archived)
    return /* HTML */ `${statusNotice(
        "实例已删除，原配置已保留",
        "可通过克隆继续同配置补建。",
        "good",
      )}${configPanel()}<button
        class="read-link"
        data-action="create"
        data-source="${row.name}"
      >
        ${icon("Copy")}克隆
      </button>`;
  if (row.building)
    return `${statusNotice(instanceStatus(row), "等待模型加载、运行就绪与实际接流。", "info")}${steps()}`;
  const isolated = state.isolated.includes(row.id);
  if (!row.healthy)
    return /* HTML */ ` ${statusNotice(
        "进程异常退出 · 当前未接流",
        "退出原因需结合事件与日志核查。",
      )}
      <div class="data-pairs">
        <p>
          停止前显存使用率<strong class="warn">98<small>%</small></strong>
        </p>
        <p>停止前在途请求<strong>12</strong></p>
      </div>
      ${chart("停止前首响应 P95", "var(--amber)")}
      <p class="quiet">14:26 后无接流，不以零时延代替缺失样本。</p>`;
  return /* HTML */ ` ${statusNotice(
      isolated
        ? "流量已隔离"
        : row.load > 80
          ? "运行中 · 性能压力较高"
          : "运行就绪 · 已实际接流",
      isolated
        ? "已暂停新请求，在途请求已排空。"
        : "运行状态与性能压力分别判断。",
      isolated ? "info" : row.load > 80 ? "warn" : "good",
    )}
    <div class="data-pairs">
      <p>
        实际请求<strong>${isolated ? "0" : row.qps}<small>req/s</small></strong>
      </p>
      <p>
        首响应 P95<strong>${isolated ? "—" : row.ttft}<small>ms</small></strong>
      </p>
      <p>
        输出吞吐<strong
          >${isolated ? "—" : "2,480"}<small>tokens/s</small></strong
        >
      </p>
      <p>在途请求<strong>${isolated ? "0" : "8"}</strong></p>
    </div>
    ${chart("首响应时延 P95", row.load > 80 ? "var(--amber)" : "var(--signal)")}
    <section class="detail-section">
      <h3>承载资源</h3>
      <div class="panel-box">
        <dl class="config-list">
          <dt>物理节点</dt>
          <dd>
            <button class="inline-resource" data-select="n${row.hostKey}">
              ${row.host} ${icon("ArrowRight")}
            </button>
          </dd>
          <dt>加速卡组</dt>
          <dd>
            Ascend 910B · NPU ${row.slots?.[0] ?? 0}–${row.slots?.at(-1) ?? 3}
          </dd>
          <dt>并行配置</dt>
          <dd>TP = 4</dd>
          <dt>实例负载</dt>
          <dd>${row.load}%</dd>
        </dl>
      </div>
    </section>`;
}
function instanceEvents(row, archived) {
  const stopped = archived || !row.healthy;
  return /* HTML */ `<section class="detail-section">
      <h3>对象事件<small>同一观察时段</small></h3>
      <div class="timeline">
        ${stopped
          ? event(
              "14:26:18",
              "进程退出 · ExitCode 137",
              "容器终止，退出原因需结合日志确认。",
            ) +
            event(
              "14:25:57",
              "显存使用率 98%",
              "停止前出现资源压力。",
              "warning",
            )
          : event(
              "14:30:12",
              row.building ? "实例准备中" : "观测到实际请求",
              row.building ? "尚未接流。" : "请求与 Token 输出已关联当前实例。",
              "success",
            ) + event("14:29:42", "运行就绪", "就绪探测通过。", "success")}
      </div>
    </section>
    <section class="detail-section">
      <h3>关联日志<small>${row.name}</small></h3>
      <pre class="log">
${stopped
          ? "14:26:18 container terminated\nexitCode=137 reason=Error\n14:25:57 accelerator_memory=98%"
          : "14:30:12 requests_total += 1\n14:30:12 output_tokens += 128\n14:29:42 readiness=passed"}</pre
      >
    </section>`;
}
function resourceMonitoring(host, slot) {
  const gpu = slot >= 0;
  const jobs = hardwareWorkloads(host.key);
  const stats = cardTelemetry(host.key, gpu ? slot : 0);
  const used = jobs.reduce((sum, job) => sum + job.slots.length, 0);
  const allocated = jobs.some(
    (job) => job.current && (!gpu || job.slots.includes(slot)),
  );
  const scheduling = hostScheduling(host.key);
  return /* HTML */ `${statusNotice(
      scheduling === "可调度" ? "资源健康正常" : scheduling,
      scheduling === "维护中"
        ? "业务负载已迁出，设备绑定已释放。"
        : scheduling === "已暂停调度"
          ? "不再放置新实例，按维护步骤处理现有负载。"
          : gpu
            ? "设备状态与所属实例接流分别观测。"
            : "当前节点承载当前服务及其他服务负载。",
      scheduling === "可调度" ? "good" : "info",
    )}
    <div class="data-pairs">
      <p>
        ${gpu ? "算力使用率" : "CPU 使用"}<strong
          >${gpu ? stats.utilization : used ? "16 / 64" : "2 / 64"}<small
            >${gpu ? "%" : "核"}</small
          ></strong
        >
      </p>
      <p>
        ${gpu ? "显存使用" : "内存使用"}<strong
          >${gpu
            ? stats.memory + " / 64"
            : used
              ? "138 / 512"
              : "24 / 512"}<small>GiB</small></strong
        >
      </p>
      ${gpu
        ? `<p>温度<strong>${stats.temperature}<small>°C</small></strong></p><p>功耗<strong>${stats.power}<small>W</small></strong></p>`
        : `<p>卡分配<strong>${used}<small>/ 8</small></strong></p><p>空闲卡<strong>${8 - used}</strong></p>`}
    </div>
    <section class="detail-section">
      <h3>GPU 槽位示意<small>KunLun G5680 V2</small></h3>
      <div class="panel-box physical-machine-panel">
        ${hardware(host, slot)}
        <div class="slot-view">
          ${Array.from(
            { length: 8 },
            (_, n) =>
              /* HTML */ `<button
                class="big-slot ${jobs.some(
                  (job) => job.current && job.slots.includes(n),
                )
                  ? "mine"
                  : ""}${n === slot ? " chosen" : ""}"
                data-select="g${host.key}-${n}"
                data-object="g${host.key}-${n}"
                aria-haspopup="menu"
                aria-pressed="${n === slot}"
              >
                NPU ${n}
              </button>`,
          ).join("")}
        </div>
        <p class="quiet hardware-caption">
          青色：所选卡片 · 右键槽位可查看设备操作
        </p>
      </div>
    </section>
    ${gpu
      ? `<div class="resource-bar"><span>算力使用 / 本服务分配</span><b>${stats.utilization}% / ${allocated ? "100" : "0"}%</b><span class="meter"><i style="width:${stats.utilization}%"></i></span></div>`
      : ""}
    ${hardwareWorkloadPanel(host)}`;
}
function resourceConfiguration(context) {
  const { host, slot, job } = context;
  return /* HTML */ `<section class="detail-section">
      <h3>硬件详情</h3>
      <div class="panel-box">
        <dl class="config-list">
          <dt>节点</dt>
          <dd>${host.host}</dd>
          <dt>IP</dt>
          <dd class="mono">${host.ip}</dd>
          <dt>服务器型号</dt>
          <dd>KunLun G5680 V2</dd>
          <dt>加速卡</dt>
          <dd>Ascend 910B / 64 GiB × 8</dd>
          <dt>驱动 / 固件</dt>
          <dd>24.1.0 / 7.1.0 · 演示配置</dd>
          <dt>调度状态</dt>
          <dd>${hostScheduling(host.key)}</dd>
          ${slot >= 0
            ? /* HTML */ `<dt>设备 ID</dt>
                <dd class="mono">${host.host}/npu/${slot}</dd>
                <dt>序列号</dt>
                <dd class="mono">
                  DEMO-910B-${host.key}${String(slot).padStart(3, "0")}
                </dd>
                <dt>当前关联</dt>
                <dd>${job ? job.service + " / " + job.name : "空闲"}</dd>`
            : ""}
        </dl>
      </div>
    </section>
    ${hardware(host, slot)}`;
}
function resourceEvents(context) {
  const task = state.maintenance;
  const source = task?.sourceKey === context.key;
  const target = task?.targetKey === context.key;
  const details = source
    ? task.phase >= 5
      ? "全部负载已迁出，原节点在途与绑定均为 0。"
      : MAINTENANCE_PHASES[task.phase]
    : target && task.phase >= 3
      ? "替换副本已就绪并实际接流。"
      : "所选时段设备采集与健康状态正常。";
  return /* HTML */ `${statusNotice(
      hostScheduling(context.key),
      details,
      "good",
    )}
    <section class="detail-section">
      <h3>资源事件<small>同一观察时段</small></h3>
      <div class="timeline">
        ${event(
          "刚刚",
          source ? "节点维护状态" : target ? "承载实例迁入" : "设备采集正常",
          details,
          "success",
        )}${event(
          "14:25",
          "设备发现完成",
          "8 张 Ascend 910B 已识别，卡槽映射正常。",
          "success",
        )}
      </div>
    </section>`;
}
function renderInspector() {
  const id = state.selected;
  const archived = id === "archive";
  const row = archived
    ? state.snapshots.i3
    : instances().find((item) => item.id === id);
  const context = resourceContext(id);
  const host = context?.host;
  const tab = state.detailTab;
  let title,
    subtitle,
    status,
    type = "",
    content,
    avatar;
  const tabs = [
    ["metrics", "监控"],
    ...(row || host ? [["config", host ? "硬件" : "配置"]] : []),
    ...(host && context.slot < 0 ? [["workloads", "承载"]] : []),
    ["events", "事件"],
  ];
  if (row) {
    title = archived ? `${row.name} · 已删除` : row.name;
    subtitle = `Qwen3-32B / ${row.role || "标准推理"}`;
    status = archived ? "配置已保留" : instanceStatus(row);
    type = archived
      ? "gray"
      : row.building
        ? "blue"
        : !row.healthy
          ? "bad"
          : state.isolated.includes(row.id)
            ? "gray"
            : row.load > 80
              ? "warn"
              : "";
    avatar = "Layers";
    if (tab === "config")
      content = configPanel(
        /* HTML */ `<dt>所属节点</dt>
          <dd>${row.host}</dd>
          <dt>启动参数</dt>
          <dd class="mono">
            --tensor-parallel-size 4<br />--max-model-len 32768<br />--gpu-memory-utilization
            0.90
          </dd>
          <dt>配置来源</dt>
          <dd>
            ${archived
              ? "删除前配置快照"
              : row.id === "i4"
                ? state.copySource
                : "部署模板 v1.2.0"}
          </dd>`,
      );
    else if (tab === "events") content = instanceEvents(row, archived);
    else content = instanceMonitoring(row, archived);
  } else if (host) {
    const slot = context.slot;
    title = slot >= 0 ? `${host.host} · NPU${slot}` : host.host;
    subtitle = `${host.ip} / Ascend 910B`;
    status =
      hostScheduling(host.key) === "可调度"
        ? "资源健康"
        : hostScheduling(host.key);
    type = status === "资源健康" ? "" : "gray";
    avatar = slot >= 0 ? "Cpu" : "Server";
    content =
      tab === "config"
        ? resourceConfiguration(context)
        : tab === "events"
          ? resourceEvents(context)
          : tab === "workloads"
            ? hardwareWorkloadPanel(host)
            : resourceMonitoring(host, slot);
  } else {
    title = "Qwen3-32B";
    subtitle = `正式版本 v1.2.0 / ${state.mode === "pd" ? "P/D 分离" : "标准推理"}`;
    status = state.verified && state.cleared ? "运行正常" : "容量关注";
    type = state.verified && state.cleared ? "" : "warn";
    avatar = "Box";
    content =
      tab === "events"
        ? /* HTML */ `<section class="detail-section">
            <h3>模型部署事件</h3>
            <div class="timeline">
              ${event(
                "14:26",
                "可用实例减少",
                "实例-03 异常停止。",
                "warning",
              )}${event(
                "14:25",
                "首响应时延上升",
                "P95 达到 1,280 ms。",
                "warning",
              )}
            </div>
          </section>`
        : /* HTML */ ` <div class="data-pairs">
              <p>
                模型请求<strong
                  >${activeInstances()
                    .reduce((sum, item) => sum + Number(item.qps), 0)
                    .toFixed(1)}<small>req/s</small></strong
                >
              </p>
              <p>
                接流实例<strong
                  >${activeInstances().length}<small>/ 目标 3</small></strong
                >
              </p>
            </div>
            ${chart("模型首响应时延 P95")}
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
            </section>`;
  }
  $("inspector").innerHTML = /* HTML */ ` <div class="inspector-head">
      <div class="inspector-identity">
        <span class="object-avatar">${icon(avatar)}</span>
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
          >
            ${icon("Ellipsis")}</button
          ><button data-action="hide-inspector" aria-label="收起对象详情">
            ${icon("X")}
          </button>
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
