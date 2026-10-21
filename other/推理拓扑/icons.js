/* Local SVG geometry from Lucide.
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left,
arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right,
arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check,
chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right,
chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left,
corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up,
corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign,
download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout,
life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2,
minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music,
navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power,
radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2,
tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square,
x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
"use strict";
const ICONS = {
  Activity: /* HTML */ `<path
    d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
  ></path>`,
  ArrowDown: /* HTML */ `<path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path>`,
  ArrowLeft: /* HTML */ `<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>`,
  ArrowRight: /* HTML */ `<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>`,
  ArrowUp: /* HTML */ `<path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path>`,
  Bell: /* HTML */ `<path d="M10.268 21a2 2 0 0 0 3.464 0"></path
    ><path
      d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
    ></path>`,
  Box: /* HTML */ `<path
      d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
    ></path
    ><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>`,
  ChartNoAxesCombined: /* HTML */ `<path d="M12 16v5"></path><path d="M16 14.639V21"></path
    ><path d="M20 10.656V21"></path
    ><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"></path
    ><path d="M4 18.463V21"></path><path d="M8 14.656V21"></path>`,
  Check: /* HTML */ `<path d="M20 6 9 17l-5-5"></path>`,
  ChevronDown: /* HTML */ `<path d="m6 9 6 6 6-6"></path>`,
  CircleAlert: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line>`,
  CircleHelp: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path>`,
  ClipboardList: /* HTML */ `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect
    ><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path
    ><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path
    ><path d="M8 16h.01"></path>`,
  Clock: /* HTML */ `<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>`,
  Copy: /* HTML */ `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect
    ><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>`,
  Cpu: /* HTML */ `<path d="M12 20v2"></path><path d="M12 2v2"></path><path d="M17 20v2"></path
    ><path d="M17 2v2"></path><path d="M2 12h2"></path><path d="M2 17h2"></path
    ><path d="M2 7h2"></path><path d="M20 12h2"></path><path d="M20 17h2"></path
    ><path d="M20 7h2"></path><path d="M7 20v2"></path><path d="M7 2v2"></path
    ><rect x="4" y="4" width="16" height="16" rx="2"></rect
    ><rect x="8" y="8" width="8" height="8" rx="1"></rect>`,
  Ellipsis: /* HTML */ `<circle cx="12" cy="12" r="1"></circle
    ><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>`,
  FileText: /* HTML */ `<path
      d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
    ></path
    ><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path
    ><path d="M16 17H8"></path>`,
  GitCompareArrows: /* HTML */ `<circle cx="5" cy="6" r="3"></circle
    ><path d="M12 6h5a2 2 0 0 1 2 2v7"></path><path d="m15 9-3-3 3-3"></path
    ><circle cx="19" cy="18" r="3"></circle><path d="M12 18H7a2 2 0 0 1-2-2V9"></path
    ><path d="m9 15 3 3-3 3"></path>`,
  Globe: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>`,
  Hexagon: /* HTML */ `<path
    d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  ></path>`,
  Home: /* HTML */ `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path
    ><path
      d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    ></path>`,
  House: /* HTML */ `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path
    ><path
      d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    ></path>`,
  KeyRound: /* HTML */ `<path
      d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"
    ></path
    ><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle>`,
  Layers: /* HTML */ `<path
      d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
    ></path
    ><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"></path
    ><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"></path>`,
  LayoutGrid: /* HTML */ `<rect width="7" height="7" x="3" y="3" rx="1"></rect
    ><rect width="7" height="7" x="14" y="3" rx="1"></rect
    ><rect width="7" height="7" x="14" y="14" rx="1"></rect
    ><rect width="7" height="7" x="3" y="14" rx="1"></rect>`,
  Lightbulb: /* HTML */ `<path
      d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
    ></path
    ><path d="M9 18h6"></path><path d="M10 22h4"></path>`,
  Maximize: /* HTML */ `<path d="M8 3H5a2 2 0 0 0-2 2v3"></path
    ><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path
    ><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>`,
  MonitorCheck: /* HTML */ `<path d="m9 10 2 2 4-4"></path
    ><rect width="20" height="14" x="2" y="3" rx="2"></rect><path d="M12 17v4"></path
    ><path d="M8 21h8"></path>`,
  Moon: /* HTML */ `<path
    d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
  ></path>`,
  Mouse: /* HTML */ `<rect x="5" y="2" width="14" height="20" rx="7"></rect
    ><path d="M12 6v4"></path>`,
  Network: /* HTML */ `<rect x="16" y="16" width="6" height="6" rx="1"></rect
    ><rect x="2" y="16" width="6" height="6" rx="1"></rect
    ><rect x="9" y="2" width="6" height="6" rx="1"></rect
    ><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path>`,
  Play: /* HTML */ `<path
    d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
  ></path>`,
  Plus: /* HTML */ `<path d="M5 12h14"></path><path d="M12 5v14"></path>`,
  RefreshCw: /* HTML */ `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path
    ><path d="M21 3v5h-5"></path
    ><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path
    ><path d="M8 16H3v5"></path>`,
  Search: /* HTML */ `<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>`,
  Server: /* HTML */ `<rect width="20" height="8" x="2" y="2" rx="2" ry="2"></rect
    ><rect width="20" height="8" x="2" y="14" rx="2" ry="2"></rect
    ><line x1="6" x2="6.01" y1="6" y2="6"></line><line x1="6" x2="6.01" y1="18" y2="18"></line>`,
  Sun: /* HTML */ `<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path
    ><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path
    ><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path
    ><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>`,
  Trash2: /* HTML */ `<path d="M10 11v6"></path><path d="M14 11v6"></path
    ><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path
    ><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>`,
  UserRound: /* HTML */ `<circle cx="12" cy="8" r="5"></circle
    ><path d="M20 21a8 8 0 0 0-16 0"></path>`,
  Wrench: /* HTML */ `<path
    d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"
  ></path>`,
  X: /* HTML */ `<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`,
  Zap: /* HTML */ `<path
    d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"
  ></path>`,
};
function icon(name) {
  return `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
    ${ICONS[name] || ICONS.CircleHelp}
  </svg>`;
}
for (const placeholder of document.querySelectorAll("[data-lucide]")) {
  const name = placeholder.dataset.lucide.replace(/(^|-)([a-z])/g, (_, dash, c) => c.toUpperCase());
  const template = document.createElement("template");
  template.innerHTML = icon(name);
  const svg = template.content.firstElementChild;
  svg.setAttribute("class", placeholder.getAttribute("class") || "icon");
  if (placeholder.hasAttribute("aria-label")) {
    svg.setAttribute("aria-label", placeholder.getAttribute("aria-label"));
    svg.removeAttribute("aria-hidden");
    svg.setAttribute("role", "img");
  }
  placeholder.replaceWith(svg);
}
