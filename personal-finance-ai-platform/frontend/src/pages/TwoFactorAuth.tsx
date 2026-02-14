import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ShieldCheck, ArrowRight, Loader2, Lock } from 'lucide-react'
import SpendWiseLogo from '../components/SpendWiseLogo'

const TwoFactorAuth = () => {
    const { verifyTwoFactor } = useAuth()
    const [code, setCode] = useState(['', '', '', '', '', ''])
    const [verifying, setVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    useEffect(() => {
        // Focus the first input on mount
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus()
        }
    }, [])

    const handleChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return

        const newCode = [...code]
        newCode[index] = value
        setCode(newCode)

        if (value !== '' && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('')
        if (pastedData.every(char => !isNaN(Number(char)))) {
            const newCode = [...code]
            pastedData.forEach((char, index) => {
                newCode[index] = char
            })
            setCode(newCode)
            inputRefs.current[Math.min(pastedData.length, 5)]?.focus()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const fullCode = code.join('')
        if (fullCode.length !== 6) return

        setError(null)
        setVerifying(true)
        try {
            await verifyTwoFactor(fullCode)
        } catch (err) {
            setError('Invalid verification code. Please try again.')
            // Reset code on error? Maybe just keep it for now.
        } finally {
            setVerifying(false)
        }
    }

    return (
        <div className="flex min-h-screen w-full bg-[#fbf8f4]">
            {/* Left Side: Design & Branding - Identical to Login/Register for consistency */}
            <div className="relative hidden w-1/2 flex-col bg-[#2b2521] p-12 text-white lg:flex">
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <img
                        src="https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80"
                        alt="Security and Protection"
                        className="h-full w-full object-cover opacity-50 mix-blend-overlay"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2b2521] via-transparent to-transparent" />
                </div>

                <div className="relative z-10 text-white">
                    <SpendWiseLogo light />
                </div>

                <div className="relative z-10 mt-auto">
                    <blockquote className="space-y-4">
                        <h2 className="text-2xl font-bold leading-tight">Secure & Protected</h2>
                        <p className="text-lg font-medium leading-relaxed text-white/80">
                            Your financial data is encrypted and protected with industry-leading security standards. We ensure your peace of mind.
                        </p>
                        <div className="flex items-center gap-2 text-sm text-[#d07a63]">
                            <Lock className="h-4 w-4" />
                            <span className="font-semibold">End-to-End Encryption</span>
                        </div>
                    </blockquote>
                </div>
            </div>

            {/* Right Side: 2FA Form */}
            <div className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4ebe6]">
                            <ShieldCheck className="h-8 w-8 text-[#d07a63]" />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Verification Required</h1>
                        <p className="mt-2 text-sm text-[#6f6158]">
                            We&apos;ve sent a secure code to your device. <br />Enter it below to continue.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
                        <div className="flex justify-center gap-3">
                            {code.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => (inputRefs.current[index] = el)}
                                    type="text"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    onPaste={handlePaste}
                                    className="h-14 w-12 rounded-xl border-2 border-[#e8e4df] bg-white text-center text-2xl font-bold text-[#2b2521] shadow-sm transition-all focus:border-[#d07a63] focus:outline-none focus:ring-1 focus:ring-[#d07a63] focus:ring-offset-2"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                />
                            ))}
                        </div>

                        {error && (
                            <div className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-800 ring-1 ring-red-200">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={verifying || code.join('').length !== 6}
                            className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2b2521] py-4 text-sm font-bold text-white shadow-xl transition hover:bg-[#4a403a] hover:shadow-2xl disabled:opacity-50"
                        >
                            {verifying ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    Verify Access
                                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>

                        <div className="text-center text-sm">
                            <p className="text-[#6f6158]">
                                Didn&apos;t receive the code?{' '}
                                <button type="button" className="font-semibold text-[#d07a63] hover:text-[#b85f4a] hover:underline">
                                    Resend Code
                                </button>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default TwoFactorAuth
