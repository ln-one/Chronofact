import type { SVGProps } from 'react'

/**
 * Chronofact 品牌 Logo
 * 盾牌 + 内部链式节点：象征"可信证据链"
 */
export function ChronofactLogo({
  size = 32,
  className,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 32 32'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      {...props}
    >
      {/* 盾牌外形 */}
      <path
        d='M16 2L4 7v8c0 7.73 5.12 14.96 12 17 6.88-2.04 12-9.27 12-17V7L16 2Z'
        fill='url(#shield-fill)'
        stroke='url(#shield-stroke)'
        strokeWidth='1'
      />
      {/* 链式节点 - 上 */}
      <circle cx='16' cy='10' r='2.5' fill='white' fillOpacity='0.9' />
      {/* 链式节点 - 左下 */}
      <circle cx='11.5' cy='18' r='2.5' fill='white' fillOpacity='0.9' />
      {/* 链式节点 - 右下 */}
      <circle cx='20.5' cy='18' r='2.5' fill='white' fillOpacity='0.9' />
      {/* 连接线 */}
      <line x1='16' y1='12.5' x2='11.5' y2='15.5' stroke='white' strokeOpacity='0.6' strokeWidth='1.2' />
      <line x1='16' y1='12.5' x2='20.5' y2='15.5' stroke='white' strokeOpacity='0.6' strokeWidth='1.2' />
      <line x1='11.5' y1='18' x2='20.5' y2='18' stroke='white' strokeOpacity='0.6' strokeWidth='1.2' />
      {/* 节点中心点 */}
      <circle cx='16' cy='10' r='1' fill='url(#shield-fill)' />
      <circle cx='11.5' cy='18' r='1' fill='url(#shield-fill)' />
      <circle cx='20.5' cy='18' r='1' fill='url(#shield-fill)' />

      <defs>
        <linearGradient id='shield-fill' x1='4' y1='2' x2='28' y2='27'>
          <stop stopColor='#059669' />
          <stop offset='1' stopColor='#0d9488' />
        </linearGradient>
        <linearGradient id='shield-stroke' x1='4' y1='2' x2='28' y2='27'>
          <stop stopColor='#047857' />
          <stop offset='1' stopColor='#0f766e' />
        </linearGradient>
      </defs>
    </svg>
  )
}

/**
 * 小尺寸 Logo（用于 favicon / 消息头像）
 */
export function ChronofactMark({
  size = 20,
  className,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 20 20'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      {...props}
    >
      <path
        d='M10 1L2 4.5v5c0 4.83 3.2 9.35 8 10.5 4.8-1.15 8-5.67 8-10.5v-5L10 1Z'
        fill='url(#mark-fill)'
      />
      <circle cx='10' cy='7' r='1.5' fill='white' fillOpacity='0.9' />
      <circle cx='7' cy='12' r='1.5' fill='white' fillOpacity='0.9' />
      <circle cx='13' cy='12' r='1.5' fill='white' fillOpacity='0.9' />
      <line x1='10' y1='8.5' x2='7' y2='10.5' stroke='white' strokeOpacity='0.5' strokeWidth='0.8' />
      <line x1='10' y1='8.5' x2='13' y2='10.5' stroke='white' strokeOpacity='0.5' strokeWidth='0.8' />
      <line x1='7' y1='12' x2='13' y2='12' stroke='white' strokeOpacity='0.5' strokeWidth='0.8' />
      <defs>
        <linearGradient id='mark-fill' x1='2' y1='1' x2='18' y2='16'>
          <stop stopColor='#059669' />
          <stop offset='1' stopColor='#0d9488' />
        </linearGradient>
      </defs>
    </svg>
  )
}
