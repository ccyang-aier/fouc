/**
 * 液态玻璃滤镜定义：移植自 liquid-glass-react（MIT）标准模式的核心——
 * 位移贴图驱动三通道色散位移（feDisplacementMap×feColorMatrix + screen 混合），
 * 仅在边缘环形区域产生折射弯折与色散，中心保持清晰。
 * 经 CSS `filter: url(#liquid-glass)` 作用于 backdrop-filter 层之上；
 * 滤镜子区域按目标元素包围盒取百分比，全局挂载一次即可适配任意尺寸。
 */

import { LIQUID_GLASS_MAP } from "./liquid-glass-map"

/** 位移强度（px 级）：贴图边缘环的最大弯折量，药丸级控件参考值约 70 */
const DISPLACEMENT_SCALE = 40
/** 色散强度：红/绿/蓝通道位移的比例差与边缘色散遮罩的陡峭程度 */
const ABERRATION_INTENSITY = 2

export function LiquidGlassFilters() {
  return (
    <svg aria-hidden className="pointer-events-none absolute size-0 overflow-hidden">
      <defs>
        <filter
          id="liquid-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            x="0"
            y="0"
            width="100%"
            height="100%"
            result="DISPLACEMENT_MAP"
            href={LIQUID_GLASS_MAP}
            preserveAspectRatio="xMidYMid slice"
          />
          {/* 由位移贴图自身推导边缘环遮罩：中心透明、边缘不透明 */}
          <feColorMatrix
            in="DISPLACEMENT_MAP"
            type="matrix"
            values="0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0.3 0.3 0.3 0 0
                    0 0 0 1 0"
            result="EDGE_INTENSITY"
          />
          <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
            <feFuncA type="discrete" tableValues={`0 ${ABERRATION_INTENSITY * 0.05} 1`} />
          </feComponentTransfer>
          {/* 中心保留未位移的原像 */}
          <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />
          {/* 三通道各按略不同比例位移，screen 混合出边缘色散 */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={-DISPLACEMENT_SCALE}
            xChannelSelector="R"
            yChannelSelector="B"
            result="RED_DISPLACED"
          />
          <feColorMatrix
            in="RED_DISPLACED"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="RED_CHANNEL"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={-DISPLACEMENT_SCALE * (1 + ABERRATION_INTENSITY * 0.05)}
            xChannelSelector="R"
            yChannelSelector="B"
            result="GREEN_DISPLACED"
          />
          <feColorMatrix
            in="GREEN_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="GREEN_CHANNEL"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="DISPLACEMENT_MAP"
            scale={-DISPLACEMENT_SCALE * (1 + ABERRATION_INTENSITY * 0.1)}
            xChannelSelector="R"
            yChannelSelector="B"
            result="BLUE_DISPLACED"
          />
          <feColorMatrix
            in="BLUE_DISPLACED"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="BLUE_CHANNEL"
          />
          <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
          <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
          <feGaussianBlur
            in="RGB_COMBINED"
            stdDeviation={Math.max(0.1, 0.5 - ABERRATION_INTENSITY * 0.1)}
            result="ABERRATED_BLURRED"
          />
          <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />
          <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
          <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
        </filter>
      </defs>
    </svg>
  )
}
