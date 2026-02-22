import clsx from 'clsx'

type SpendWiseLogoProps = {
  compact?: boolean
  className?: string
}

const SpendWiseLogo = ({ compact = false, className, light = false }: SpendWiseLogoProps & { light?: boolean }) => {
  return (
    <div className={clsx('flex items-center gap-3 select-none', className)}>
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d07a63] shadow-[0_12px_30px_rgba(208,122,99,0.35)]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M12 3c2.9 0 5.3 2.4 5.3 5.3 0 2.3-1.2 4.2-2.9 5.5-.7.5-1.1 1.4-1.1 2.2V20a1 1 0 0 1-1 1h-2.6a1 1 0 0 1-1-1v-4.8c0-.8-.4-1.7-1.1-2.2C5.9 12.7 4.7 10.8 4.7 8.3 4.7 5.4 7.1 3 10 3h2Z"
            fill="#fff"
            opacity="0.95"
          />
          <path
            d="M7.2 6.8c1.2-1.2 3-2 4.8-2 1.9 0 3.6.8 4.8 2"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      </div>

      {!compact && (
        <div className="leading-tight">
          <div className={clsx('text-lg font-extrabold tracking-tight', light ? 'text-white' : 'text-[#2b2521]')}>
            SpendWise
          </div>
          <div className={clsx('text-xs font-medium tracking-wide', light ? 'text-[#dccac0]' : 'text-[#a08f85]')}>
            Personal finance
          </div>
        </div>
      )}
    </div>
  )
}

export default SpendWiseLogo

