import Image from "next/image"

export function HomeAssistant() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-[101px] right-1 z-10 h-[116px] w-[138px] select-none max-[760px]:-top-[78px] max-[760px]:right-0 max-[760px]:h-[90px] max-[760px]:w-[108px]"
    >
      <Image
        src="/brand/fouc-assistant.png"
        alt=""
        fill
        priority
        sizes="(max-width: 760px) 108px, 138px"
        className="object-contain object-bottom drop-shadow-[0_8px_12px_rgba(34,39,45,0.08)] transition-transform duration-300 ease-out motion-safe:group-focus-within/composer:-translate-y-0.5 motion-safe:group-hover/composer:-translate-y-0.5"
      />
    </div>
  )
}
