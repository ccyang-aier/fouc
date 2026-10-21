/* exported icon */
/* Local Lucide SVG geometry.
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The following Lucide icons are derived from the Feather project:
 *
 * airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle,
 * arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left,
 * arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right,
 * arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right,
 * chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle,
 * clipboard, clock, code, columns, command, compass, corner-down-left,
 * corner-down-right, corner-left-down, corner-left-up, corner-right-down,
 * corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle,
 * divide-square, dollar-sign, download, external-link, feather, frown, hash,
 * headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader,
 * lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle,
 * minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music,
 * navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square,
 * plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone,
 * smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type,
 * upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out
 *
 * The MIT License (MIT) (for the icons listed above)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
const iconPaths = {
  home: /* HTML */ `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path
    ><path
      d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    ></path>`,
  resource: /* HTML */ `<path
      d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
    ></path
    ><path
      d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
    ></path
    ><path
      d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
    ></path>`,
  model: /* HTML */ `<path
      d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
    ></path
    ><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>`,
  apps: /* HTML */ `<path d="M12 3v18"></path><path d="M3 12h18"></path
    ><rect x="3" y="3" width="18" height="18" rx="2"></rect>`,
  monitor: /* HTML */ `<path d="m12 14 4-4"></path
    ><path d="M3.34 19a10 10 0 1 1 17.32 0"></path>`,
  tool: /* HTML */ `<path
    d="
M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0
1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z
"
  ></path>`,
  setting: /* HTML */ `<path
      d="
M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34
2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0
2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35
6.051a2.34 2.34 0 0 0 3.319-1.915
"
    ></path
    ><circle cx="12" cy="12" r="3"></circle>`,
  menu: /* HTML */ `<rect width="18" height="18" x="3" y="3" rx="2"></rect
    ><path d="M9 3v18"></path>`,
  market: /* HTML */ `<rect x="16" y="16" width="6" height="6" rx="1"></rect
    ><rect x="2" y="16" width="6" height="6" rx="1"></rect
    ><rect x="9" y="2" width="6" height="6" rx="1"></rect
    ><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path
    ><path d="M12 12V8"></path>`,
  screen: /* HTML */ `<rect width="20" height="14" x="2" y="3" rx="2"></rect
    ><line x1="8" x2="16" y1="21" y2="21"></line
    ><line x1="12" x2="12" y1="17" y2="21"></line>`,
  api: /* HTML */ `<path d="M15 6a9 9 0 0 0-9 9V3"></path
    ><circle cx="18" cy="6" r="3"></circle
    ><circle cx="6" cy="18" r="3"></circle>`,
  down: /* HTML */ `<path d="m6 9 6 6 6-6"></path>`,
  right: /* HTML */ `<path d="m9 18 6-6-6-6"></path>`,
  audit: /* HTML */ `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect
    ><path
      d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
    ></path
    ><path d="m9 14 2 2 4-4"></path>`,
  file: /* HTML */ `<path
      d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
    ></path
    ><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path
    ><path d="M16 13H8"></path><path d="M16 17H8"></path>`,
  data: /* HTML */ `<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse
    ><path d="M3 5V19A9 3 0 0 0 21 19V5"></path
    ><path d="M3 12A9 3 0 0 0 21 12"></path>`,
  book: /* HTML */ `<path d="M12 5v16"></path
    ><path
      d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"
    ></path>`,
  key: /* HTML */ `<path
      d="
M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0
1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z
"
    ></path
    ><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle>`,
  chart: /* HTML */ `<path d="M12 16v5"></path><path d="M16 14.639V21"></path
    ><path d="M20 10.656V21"></path
    ><path
      d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"
    ></path
    ><path d="M4 18.463V21"></path><path d="M8 14.656V21"></path>`,
  arrowLeft: /* HTML */ `<path d="m12 19-7-7 7-7"></path
    ><path d="M19 12H5"></path>`,
  arrowRight: /* HTML */ `<path d="M5 12h14"></path
    ><path d="m12 5 7 7-7 7"></path>`,
  compare: /* HTML */ `<path d="M8 3 4 7l4 4"></path><path d="M4 7h16"></path
    ><path d="m16 21 4-4-4-4"></path><path d="M20 17H4"></path>`,
  checkCircle: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><path d="m16 9-5.5 5.5L8 12"></path>`,
  clock: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><path d="M12 6v6h4"></path>`,
  info: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><path d="M12 16v-4"></path><path d="M12 8h.01"></path>`,
  reload: /* HTML */ `<path
      d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
    ></path
    ><path d="M21 3v5h-5"></path>`,
  question: /* HTML */ `<circle cx="12" cy="12" r="10"></circle
    ><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path
    ><path d="M12 17h.01"></path>`,
  bell: /* HTML */ `<path d="M10.268 21a2 2 0 0 0 3.464 0"></path
    ><path
      d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
    ></path>`,
  user: /* HTML */ `<circle cx="12" cy="8" r="5"></circle
    ><path d="M20 21a8 8 0 0 0-16 0"></path>`,
  close: /* HTML */ `<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>`,
  sparkles: /* HTML */ `<path
      d="
M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0
1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0
0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z
"
    ></path
    ><path d="M20 2v4"></path><path d="M22 4h-4"></path
    ><circle cx="4" cy="20" r="2"></circle>`,
  play: /* HTML */ `<path
    d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
  ></path>`,
  check: /* HTML */ `<path d="M20 6 9 17l-5-5"></path>`,
};
function icon(name, className = "") {
  return /* HTML */ `<svg
    class="icon ${className}"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${iconPaths[name] || iconPaths.info}
  </svg>`;
}
