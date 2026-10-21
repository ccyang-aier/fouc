/* exported hardware */
"use strict";

// The viewport isolates the original chassis render from the supplied product image.
const CHASSIS_SLOTS = [
  "96,133 120,111 152,121 129,145",
  "126,153 150,131 182,141 159,165",
  "156,173 180,151 212,161 189,185",
  "186,193 210,171 242,181 219,205",
  "180,88 204,66 236,76 213,100",
  "210,108 234,86 266,96 243,120",
  "240,128 264,106 296,116 273,140",
  "270,148 294,126 326,136 303,160",
];

function hardware(host, selected = -1) {
  const number = host.key;
  const jobs = hardwareWorkloads(number);
  const clipId = /* HTML */ `chassis-${number}-${selected < 0
    ? "all"
    : selected}`;
  return /* HTML */ `
    <div class="hardware-detail">
      <svg
        class="chassis-visual"
        viewBox="0 0 385 320"
        aria-label="KunLun G5680 V2 物理机与 8 张加速卡槽位"
      >
        <defs>
          <clipPath id="${clipId}">
            <polygon
              points="198,6 198,31 356,63 369,52 369,125 200,308 8,245 8,165 163,43"
            />
          </clipPath>
        </defs>
        <image
          href="./assets/kunlun-g5680-reference.png"
          x="-2030"
          y="-820"
          width="2516"
          height="1234"
          clip-path="url(#${clipId})"
          class="chassis-image"
        />
        ${CHASSIS_SLOTS.map(
          (points, slot) => /* HTML */ `
            <polygon
              class="chassis-slot ${selected === slot ? "is-selected" : ""}"
              points="${points}"
              role="button"
              tabindex="0"
              data-select="g${number}-${slot}"
              data-object="g${number}-${slot}"
              aria-haspopup="menu"
              aria-label="选择 ${host.host} NPU${slot} 槽位"
              aria-pressed="${selected === slot}"
            >
              <title>
                NPU${slot} ·
                ${jobs.find((job) => job.slots.includes(slot))?.name || "空闲"}
              </title>
            </polygon>
          `,
        ).join("")}
      </svg>
    </div>
  `;
}
