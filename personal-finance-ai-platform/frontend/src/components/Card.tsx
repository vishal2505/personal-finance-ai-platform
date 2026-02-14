import clsx from 'clsx'

interface CardProps {
    children: React.ReactNode
    className?: string
}

const Card: React.FC<CardProps> = ({ children, className }) => (
    <div
        className={clsx(
            'rounded-3xl bg-white/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur',
            className
        )}
    >
        {children}
    </div>
)

export default Card
