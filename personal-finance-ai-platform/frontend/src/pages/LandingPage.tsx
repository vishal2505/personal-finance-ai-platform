import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Target, Wallet } from 'lucide-react'
import SpendWiseLogo from '../components/SpendWiseLogo'

const LandingPage = () => {
    // Simple hook for scroll animations
    const useScrollAnimation = () => {
        useEffect(() => {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('animate-fade-in-up')
                            entry.target.classList.remove('opacity-0', 'translate-y-8')
                        }
                    })
                },
                { threshold: 0.1 }
            )

            const elements = document.querySelectorAll('.reveal-on-scroll')
            elements.forEach((el) => observer.observe(el))

            return () => elements.forEach((el) => observer.unobserve(el))
        }, [])
    }

    useScrollAnimation()

    return (
        <div className="min-h-screen bg-[#fbf8f4] font-sans text-[#2b2521]">
            {/* Navigation */}
            <nav className="absolute top-0 z-50 w-full px-6 py-6">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-2">
                        <SpendWiseLogo />
                    </div>
                    <div className="hidden items-center gap-8 md:flex">
                        <Link to="/features" className="text-sm font-medium text-[#6f6158] hover:text-[#2b2521]">
                            Features
                        </Link>
                        <Link to="/pricing" className="text-sm font-medium text-[#6f6158] hover:text-[#2b2521]">
                            Pricing
                        </Link>
                        <Link to="/about" className="text-sm font-medium text-[#6f6158] hover:text-[#2b2521]">
                            About
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-[#6f6158] hover:text-[#2b2521]"
                        >
                            Log In
                        </Link>
                        <Link
                            to="/register"
                            className="rounded-full bg-[#d07a63] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c96f58]"
                        >
                            Sign Up
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header
                className="relative flex min-h-[90vh] items-center overflow-hidden px-6 pt-24 pb-24"
                style={{
                    backgroundImage: `url('https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?q=80&w=2671&auto=format&fit=crop')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                {/* Overlay */}
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-[#fbf8f4]/95 via-[#fbf8f4]/80 to-transparent" />
                <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#fbf8f4] via-transparent to-transparent" />

                <div className="relative z-10 mx-auto max-w-7xl w-full">
                    <div className="max-w-3xl animate-fade-in-up">
                        <h1 className="text-6xl font-extrabold leading-tight tracking-tight text-[#2b2521] md:text-8xl">
                            Master <br />
                            <span className="bg-gradient-to-r from-[#4a5d4f] to-[#738879] bg-clip-text text-transparent">
                                Your Money
                            </span>{' '}
                            <br />
                            with AI
                        </h1>
                        <p className="mt-8 max-w-xl text-xl text-[#6f6158] md:text-2xl animation-delay-200 animate-fade-in-up">
                            Experience growth and abundance. Take control of your finances with automated
                            tracking and intelligent insights.
                        </p>
                    </div>
                </div>
            </header>

            {/* Features Section */}
            <section className="bg-[#fcfaf8] px-6 py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mx-auto max-w-2xl text-center reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                        <p className="font-bold uppercase tracking-wider text-[#d07a63] text-xs">Core Capabilities</p>
                        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#2b2521]">
                            Smarter Finance Management
                        </h2>
                        <p className="mt-4 text-[#6f6158]">
                            SpendWise uses advanced AI to make budgeting effortless, so you can focus on what
                            matters most.
                        </p>
                    </div>

                    <div className="mt-20 grid gap-16 md:grid-cols-2 lg:gap-24">
                        {/* Feature 1 */}
                        <div className="flex flex-col justify-center reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out delay-200">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4ebe6] text-[#d07a63]">
                                <Wallet className="h-8 w-8" />
                            </div>
                            <h3 className="text-3xl font-bold text-[#2b2521]">Expense Tracking</h3>
                            <p className="mt-4 text-lg text-[#6f6158]">
                                Sync your banks and let AI categorize your spending automatically. No more manual
                                entry or spreadsheets.
                            </p>
                        </div>
                        <div className="relative overflow-hidden rounded-3xl bg-[#e8e4df] shadow-2xl reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                            <img
                                src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800"
                                alt="Expense Tracking"
                                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                        </div>

                        {/* Feature 2 */}
                        <div className="relative overflow-hidden rounded-3xl bg-[#e8e4df] shadow-2xl md:order-last lg:order-none reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                            <img
                                src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=800"
                                alt="AI Insights"
                                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                        </div>
                        <div className="flex flex-col justify-center reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out delay-200">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ffe9e2] text-[#d07a63]">
                                <BarChart3 className="h-8 w-8" />
                            </div>
                            <h3 className="text-3xl font-bold text-[#2b2521]">AI Insights</h3>
                            <p className="mt-4 text-lg text-[#6f6158]">
                                Receive personalized advice on where to cut back and how to optimize your budget
                                based on your habits.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="flex flex-col justify-center reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out delay-200">
                            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#efece7] text-[#8c7e74]">
                                <Target className="h-8 w-8" />
                            </div>
                            <h3 className="text-3xl font-bold text-[#2b2521]">Goal Planning</h3>
                            <p className="mt-4 text-lg text-[#6f6158]">
                                Set financial milestones and track your progress with real-time projections and
                                smart savings alerts.
                            </p>
                        </div>
                        <div className="relative overflow-hidden rounded-3xl bg-[#e8e4df] shadow-2xl reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                            <img
                                src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=800"
                                alt="Goal Planning"
                                className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="px-6 py-24">
                <div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-[#2b2521] px-6 py-20 text-center shadow-2xl md:px-20 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-1000 ease-out">
                    <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                        Ready to take control <br /> of your future?
                    </h2>
                    <p className="mx-auto mt-6 max-w-xl text-lg text-[#9a8678]">
                        Join over 50,000+ users who are saving an average of $450 per month with SpendWise.
                    </p>
                    <div className="mt-10">
                        <Link
                            to="/register"
                            className="inline-block rounded-full bg-[#d07a63] px-10 py-4 text-lg font-semibold text-white transition hover:bg-[#c96f58]"
                        >
                            Get Started Now
                        </Link>
                    </div>
                    <p className="mt-6 text-sm text-[#6f6158]">
                        No credit card required. 14-day free trial.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="mx-auto max-w-7xl px-6 py-12">
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                    <div className="flex items-center gap-2">
                        <SpendWiseLogo />
                        <span className="text-xs text-[#9a8678] ml-4">© 2026 SpendWise Inc.</span>
                    </div>
                    <div className="flex gap-8 text-sm text-[#6f6158]">
                        <Link to="#" className="hover:text-[#2b2521]">
                            Privacy Policy
                        </Link>
                        <Link to="#" className="hover:text-[#2b2521]">
                            Terms of Service
                        </Link>
                        <Link to="#" className="hover:text-[#2b2521]">
                            Support
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default LandingPage
