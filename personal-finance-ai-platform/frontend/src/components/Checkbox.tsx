import clsx from 'clsx'
import { Check } from 'lucide-react'

interface CheckboxProps {
    checked: boolean
    onChange: () => void
    disabled?: boolean
    className?: string
}

const Checkbox = ({ checked, onChange, disabled, className }: CheckboxProps) => {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
            className={clsx(
                'group flex h-5 w-5 items-center justify-center rounded-md border transition',
                checked
                    ? 'border-[#d07a63] bg-[#d07a63] text-white'
                    : 'border-[#e8e4df] bg-white text-transparent hover:border-[#d07a63]',
                disabled && 'cursor-not-allowed opacity-50',
                className
            )}
        >
            <Check strokeWidth={3} className={clsx('h-3.5 w-3.5 transform transition', checked ? 'scale-100' : 'scale-0')} />
        </button>
    )
}

export default Checkbox
