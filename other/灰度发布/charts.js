/* exported drawChart */
// Aligned demonstration series, canvas rendering, and shared-point inspection.
const chartColors = { old: "#2d5cf6", new: "#0e9b8c" };
const chartModels = new WeakMap();
let pinnedChart = null;
let chartTooltipSequence = 0;

function chartSeries(key, version) {
  const count = periods[state.period].points;
  const phase =
    (version === "old" ? 0.5 : 1.4) +
    { failure: 0, timeout: 2.1, ttft: 0.7, tpot: 1.6 }[key];
  const wave = Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1);
    return (
      Math.sin(position * Math.PI * 4.2 + phase) * 0.12 +
      Math.cos(position * Math.PI * 2 + phase * 0.5) * 0.04
    );
  });
  const mean = wave.reduce((sum, value) => sum + value, 0) / count;
  return wave.map((value) => metricValues(key)[version] * (1 + value - mean));
}

function chartTime(minutes) {
  const rounded = Math.round(minutes);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function chartValue(value, key) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: ["failure", "timeout"].includes(key) ? 2 : 0,
    maximumFractionDigits: ["failure", "timeout"].includes(key) ? 2 : 1,
  });
}

function smoothChartPath(points) {
  const slopes = points
    .slice(1)
    .map(
      (point, index) =>
        (point.y - points[index].y) / (point.x - points[index].x),
    );
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes.at(-1);
    const before = slopes[index - 1];
    const after = slopes[index];
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const point = points[index];
    const handle = (point.x - previous.x) / 3;
    path.bezierCurveTo(
      previous.x + handle,
      previous.y + tangents[index - 1] * handle,
      point.x - handle,
      point.y - tangents[index] * handle,
      point.x,
      point.y,
    );
  }
  return path;
}

function paintChart(model) {
  const { context, width, height, dpr, pad, plotWidth, plotHeight, metric } =
    model;
  const bottom = pad.top + plotHeight;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.font = '10px "Microsoft YaHei", sans-serif';
  for (let index = 0; index <= 4; index++) {
    const y = pad.top + (plotHeight * index) / 4;
    context.strokeStyle = "#e8edf4";
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
  for (let index = 0; index <= 4; index++) {
    context.fillStyle = "#7a879b";
    context.textAlign = index === 0 ? "left" : index === 4 ? "right" : "center";
    context.fillText(
      chartTime(model.start + ((model.end - model.start) * index) / 4),
      pad.left + (plotWidth * index) / 4,
      height - 8,
    );
  }

  for (const version of ["old", "new"]) {
    const points = model.points[version];
    const area = new Path2D(model.paths[version]);
    area.lineTo(points.at(-1).x, bottom);
    area.lineTo(points[0].x, bottom);
    area.closePath();
    const gradient = context.createLinearGradient(
      0,
      Math.min(...points.map((point) => point.y)),
      0,
      bottom,
    );
    const rgb = version === "old" ? "45,92,246" : "14,155,140";
    gradient.addColorStop(0, `rgba(${rgb},0.23)`);
    gradient.addColorStop(0.55, `rgba(${rgb},0.11)`);
    gradient.addColorStop(1, `rgba(${rgb},0.035)`);
    context.fillStyle = gradient;
    context.fill(area);
  }
  for (const version of ["old", "new"]) {
    context.strokeStyle = chartColors[version];
    context.lineWidth = 2.4;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke(model.paths[version]);
  }

  if (model.activeIndex === null) return;
  const x = model.points.old[model.activeIndex].x;
  context.strokeStyle = "#9caabc";
  context.lineWidth = 1;
  context.setLineDash([3, 3]);
  context.beginPath();
  context.moveTo(x, pad.top);
  context.lineTo(x, bottom);
  context.stroke();
  context.setLineDash([]);
  for (const version of ["old", "new"]) {
    const point = model.points[version][model.activeIndex];
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.strokeStyle = chartColors[version];
    context.lineWidth = 2;
    context.stroke();
  }
}

function hideChartInspection(model) {
  model.activeIndex = null;
  model.tooltip.hidden = true;
  model.canvas.setAttribute("aria-label", model.baseLabel);
  paintChart(model);
}

function inspectChart(model, index, keyboard = false) {
  const bounded = Math.max(0, Math.min(model.values.old.length - 1, index));
  if (model.activeIndex === bounded && !model.tooltip.hidden) return;
  model.activeIndex = bounded;
  const oldValue = model.values.old[bounded];
  const newValue = model.values.new[bounded];
  const time = chartTime(
    model.start +
      ((model.end - model.start) * bounded) / (model.values.old.length - 1),
  );
  const improved = newValue <= oldValue;
  const difference = Math.abs(oldValue - newValue);
  const differenceText = ["failure", "timeout"].includes(model.key)
    ? `${difference.toFixed(3)} 个百分点`
    : `${((difference / oldValue) * 100).toFixed(1)}%`;
  const comparison = `灰度${improved ? "降低" : "升高"} ${differenceText}`;
  model.tooltip.innerHTML = /* HTML */ `
    <div class="chart-tooltip-time">10-21 · ${time}</div>
    ${["old", "new"]
      .map(
        (version) => /* HTML */ `
          <div class="chart-tooltip-row">
            <i
              class="chart-tooltip-dot"
              style="background:${chartColors[version]}"
            ></i>
            <span>${version === "old" ? "正式版本" : "灰度版本"}</span>
            <strong class="chart-tooltip-value"
              >${chartValue(model.values[version][bounded], model.key)}
              <small>${model.metric.unit}</small></strong
            >
          </div>
        `,
      )
      .join("")}
    <div class="chart-tooltip-delta" data-improved="${improved}">
      ${comparison}
    </div>
  `;
  model.tooltip.setAttribute("aria-live", keyboard ? "polite" : "off");
  model.tooltip.hidden = false;
  const canvasBounds = model.canvas.getBoundingClientRect();
  const frameBounds = model.frame.getBoundingClientRect();
  const tooltipBounds = model.tooltip.getBoundingClientRect();
  const anchorX =
    canvasBounds.left - frameBounds.left + model.points.old[bounded].x;
  const desiredLeft = anchorX + 16;
  const left =
    desiredLeft + tooltipBounds.width <= frameBounds.width - 10
      ? desiredLeft
      : anchorX - tooltipBounds.width - 16;
  model.tooltip.style.left = `${Math.max(10, Math.min(left, frameBounds.width - tooltipBounds.width - 10))}px`;
  model.tooltip.style.top = `${canvasBounds.top - frameBounds.top + model.pad.top + 5}px`;
  model.canvas.setAttribute(
    "aria-label",
    `${model.metric.title}，${time}，正式版本 ${chartValue(oldValue, model.key)} ${model.metric.unit}，灰度版本 ${chartValue(newValue, model.key)} ${model.metric.unit}；${comparison}`,
  );
  paintChart(model);
}

function chartIndexAtPointer(model, event) {
  const x = event.clientX - model.canvas.getBoundingClientRect().left;
  if (x < model.pad.left || x > model.width - model.pad.right) return null;
  return Math.round(
    ((x - model.pad.left) / model.plotWidth) * (model.values.old.length - 1),
  );
}

function bindChartInspection(canvas) {
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const model = chartModels.get(canvas);
    const index = chartIndexAtPointer(model, event);
    if (index === null) hideChartInspection(model);
    else inspectChart(model, index);
  });
  canvas.addEventListener("pointerleave", () => {
    const model = chartModels.get(canvas);
    if (pinnedChart !== model) hideChartInspection(model);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    const model = chartModels.get(canvas);
    const index = chartIndexAtPointer(model, event);
    if (pinnedChart && pinnedChart !== model) hideChartInspection(pinnedChart);
    if (
      index === null ||
      (pinnedChart === model && model.activeIndex === index)
    ) {
      hideChartInspection(model);
      pinnedChart = null;
    } else {
      pinnedChart = model;
      inspectChart(model, index);
    }
  });
  canvas.addEventListener("focus", () => {
    const model = chartModels.get(canvas);
    inspectChart(
      model,
      model.activeIndex ?? Math.floor(model.values.old.length / 2),
      true,
    );
  });
  canvas.addEventListener("blur", () => {
    const model = chartModels.get(canvas);
    if (pinnedChart !== model) hideChartInspection(model);
  });
  canvas.addEventListener("keydown", (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)
    )
      return;
    event.preventDefault();
    const model = chartModels.get(canvas);
    if (event.key === "Escape") {
      hideChartInspection(model);
      pinnedChart = null;
      return;
    }
    const current = model.activeIndex ?? 0;
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? model.values.old.length - 1
          : current + (event.key === "ArrowRight" ? 1 : -1);
    inspectChart(model, index, true);
  });
}

function drawChart() {
  document.querySelectorAll("canvas[data-chart]").forEach((canvas) => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const key = canvas.dataset.chart;
    const metric = metricInfo[key];
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.tabIndex = 0;
    const frame = canvas.closest(".chart-frame");
    const previous = chartModels.get(canvas);
    if (pinnedChart === previous) pinnedChart = null;
    const tooltip = previous?.tooltip || document.createElement("div");
    if (!previous) {
      tooltip.className = "chart-tooltip";
      tooltip.id = `chart-tooltip-${++chartTooltipSequence}`;
      tooltip.setAttribute("role", "tooltip");
      tooltip.hidden = true;
      frame.append(tooltip);
      canvas.setAttribute("aria-describedby", tooltip.id);
      canvas.setAttribute(
        "aria-keyshortcuts",
        "ArrowLeft ArrowRight Home End Escape",
      );
      bindChartInspection(canvas);
    }
    const pad = { left: 40, right: 14, top: 16, bottom: 29 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const values = {
      old: chartSeries(key, "old"),
      new: chartSeries(key, "new"),
    };
    const points = {};
    const paths = {};
    for (const version of ["old", "new"]) {
      points[version] = values[version].map((value, index, series) => ({
        x: pad.left + (plotWidth * index) / (series.length - 1),
        y:
          pad.top +
          plotHeight * (1 - (value - metric.min) / (metric.max - metric.min)),
      }));
      paths[version] = smoothChartPath(points[version]);
    }
    const start =
      state.period === "custom"
        ? state.customStart
        : Number(periods[state.period].start.slice(0, 2)) * 60 +
          Number(periods[state.period].start.slice(3));
    const model = {
      canvas,
      frame,
      tooltip,
      key,
      metric,
      dpr,
      width,
      height,
      pad,
      plotWidth,
      plotHeight,
      values,
      points,
      paths,
      start,
      end: state.period === "custom" ? state.customEnd : 840,
      context: canvas.getContext("2d"),
      activeIndex: null,
      baseLabel:
        previous?.baseLabel ||
        `${canvas.getAttribute("aria-label")}。左右方向键查看逐时刻数据。`,
    };
    chartModels.set(canvas, model);
    tooltip.hidden = true;
    canvas.setAttribute("aria-label", model.baseLabel);
    paintChart(model);
  });
}

document.addEventListener("pointerdown", (event) => {
  if (pinnedChart && !pinnedChart.frame.contains(event.target)) {
    hideChartInspection(pinnedChart);
    pinnedChart = null;
  }
});
