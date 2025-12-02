import { motion, useScroll, useTransform, useInView } from 'motion/react'
import { useRef, useEffect, useState } from 'react'
import { Sparkles, ArrowRight, Play, CheckCircle } from 'lucide-react'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
}

interface HeroSectionProps {
  onGetStarted: () => void
  onLearnMore: () => void
}

export default function HeroSection({ onGetStarted, onLearnMore }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const titleY = useTransform(scrollYProgress, [0, 1], [0, -50])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const buttonY = useTransform(scrollYProgress, [0, 0.5], [0, 30])
  const buttonOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0])

  const isInView = useInView(containerRef, { once: true, margin: '-100px' })
  const [particles, setParticles] = useState<Particle[]>([])
  const [mounted, setMounted] = useState(false)

  // Generate random particles on mount
  useEffect(() => {
    setMounted(true)
    const newParticles: Particle[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
    }))
    setParticles(newParticles)
  }, [])

  // Floating animation values (currently unused but fine to keep for later)
  const floatValues = Array.from({ length: 6 }, (_, i) => ({
    y: useTransform(scrollYProgress, [0, 1], [0, Math.sin(i) * 30 + Math.random() * 20]),
    rotate: useTransform(scrollYProgress, [0, 1], [0, Math.cos(i) * 15 + Math.random() * 10]),
  }))

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-cyan-50/30 to-teal-50/30"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            left: '10%',
            top: '20%',
          }}
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -80, 60, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
            right: '15%',
            bottom: '20%',
          }}
          animate={{
