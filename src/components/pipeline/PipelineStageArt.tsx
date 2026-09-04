import React from 'react';
import { motion } from 'motion/react';

interface PipelineStageArtProps {
  stageNum: number;
  isActive: boolean;
  isCompleted: boolean;
}

/**
 * Animated Vector Art for each Pipeline Stage
 * Inspired directly by the user's video ("Examples of animated paths on carousels")
 * featuring dynamic SVG strokes, animated bezier loops, mind map nodes, and geometric paths.
 */
export const PipelineStageArt: React.FC<PipelineStageArtProps> = ({
  stageNum,
  isActive,
  isCompleted,
}) => {
  switch (stageNum) {
    case 1:
      // Video 00:00: Sharp tall geometric triangle path with horizontal crossbar and measurement dots
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background subtle grid marks */}
            <motion.line
              x1="50"
              y1="190"
              x2="250"
              y2="190"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <motion.line
              x1="150"
              y1="30"
              x2="150"
              y2="210"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
              strokeDasharray="2 4"
            />

            {/* Tall Sharp Triangle Path (Video 00:00) */}
            <motion.path
              d="M150 35 L 210 185 L 90 185 Z"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
              }}
              transition={{
                duration: 2.2,
                repeat: isActive ? Infinity : 0,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
            />

            {/* Inner Stylized Crossbar */}
            <motion.rect
              x="120"
              y="130"
              width="60"
              height="10"
              rx="3"
              fill="#FFFFFF"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 1.5,
                delay: 0.4,
                repeat: isActive ? Infinity : 0,
                repeatType: 'mirror',
              }}
            />

            {/* Floating parsing coordinate dots */}
            {[
              { cx: 90, cy: 185 },
              { cx: 210, cy: 185 },
              { cx: 150, cy: 35 },
              { cx: 150, cy: 110 },
            ].map((dot, i) => (
              <motion.circle
                key={i}
                cx={dot.cx}
                cy={dot.cy}
                r="4"
                fill="#FBBF24"
                initial={{ scale: 0 }}
                animate={{ scale: [0.8, 1.4, 0.8] }}
                transition={{
                  duration: 2,
                  delay: i * 0.3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </svg>
        </div>
      );

    case 2:
      // Video 00:01-00:02: Elegant curving arrow path weaving into stylized character silhouette/nodes
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Character silhouette node */}
            <motion.circle
              cx="210"
              cy="90"
              r="24"
              stroke="#FFFFFF"
              strokeWidth="3"
              fill="rgba(255,255,255,0.1)"
              animate={{
                scale: isActive ? [1, 1.08, 1] : 1,
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* Character bust outline */}
            <motion.path
              d="M175 140 C175 115, 245 115, 245 140"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Curving swooping arrow (Video 00:01) */}
            <motion.path
              d="M40 160 C 60 110, 110 90, 180 92"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 1.8,
                repeat: isActive ? Infinity : 0,
                repeatType: 'loop',
                repeatDelay: 0.5,
                ease: 'easeInOut',
              }}
            />
            {/* Arrow Head */}
            <motion.path
              d="M170 82 L185 92 L170 102"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
            />

            {/* Wardrobe lock icon indicator */}
            <motion.rect
              x="198"
              y="155"
              width="24"
              height="18"
              rx="4"
              fill="#F59E0B"
              animate={{ y: [155, 150, 155] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            <motion.path
              d="M204 155 V148 C204 144, 216 144, 216 148 V155"
              stroke="#F59E0B"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      );

    case 3:
      // Video 00:03: Bold animated numeral "8" / infinity loop vector path with breathing glow
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* World blueprint coordinate grid */}
            <motion.circle
              cx="150"
              cy="120"
              r="75"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            />

            {/* Large Figure 8 / Infinity Path (Video 00:03) */}
            <motion.path
              d="M150 120 C120 70, 90 40, 150 40 C210 40, 180 70, 150 120 C120 170, 90 200, 150 200 C210 200, 180 170, 150 120 Z"
              stroke="#FFFFFF"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 2.8,
                repeat: isActive ? Infinity : 0,
                repeatType: 'loop',
                ease: 'easeInOut',
              }}
            />

            {/* Pulsing center lens core */}
            <motion.circle
              cx="150"
              cy="120"
              r="8"
              fill="#38BDF8"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          </svg>
        </div>
      );

    case 4:
      // Video 00:04-00:05: Mind Map - interconnected nodes with animated curving lines connecting cards/boxes
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Connected curved paths (Video 00:04) */}
            <motion.path
              d="M75 60 C 120 75, 120 120, 150 120"
              stroke="#FFFFFF"
              strokeWidth="3"
              fill="none"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.path
              d="M225 60 C 180 75, 180 120, 150 120"
              stroke="#FFFFFF"
              strokeWidth="3"
              fill="none"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.path
              d="M65 180 C 110 165, 110 120, 150 120"
              stroke="#FFFFFF"
              strokeWidth="3"
              fill="none"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.path
              d="M235 180 C 190 165, 190 120, 150 120"
              stroke="#FFFFFF"
              strokeWidth="3"
              fill="none"
              strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />

            {/* Central 5-Act Anchor Node */}
            <motion.rect
              x="125"
              y="95"
              width="50"
              height="50"
              rx="8"
              fill="#FFFFFF"
              animate={{ scale: isActive ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <text
              x="150"
              y="125"
              textAnchor="middle"
              fill="#0F172A"
              fontSize="12"
              fontWeight="900"
              fontFamily="monospace"
            >
              5-ACT
            </text>

            {/* 4 Surrounding Act Node Boxes (Video 00:04) */}
            <motion.rect
              x="45"
              y="35"
              width="45"
              height="40"
              rx="6"
              fill="#FFFFFF"
              animate={{ y: [35, 32, 35] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.1 }}
            />
            <motion.rect
              x="210"
              y="35"
              width="45"
              height="40"
              rx="6"
              fill="#FFFFFF"
              animate={{ y: [35, 38, 35] }}
              transition={{ duration: 2.7, repeat: Infinity, delay: 0.3 }}
            />
            <motion.rect
              x="40"
              y="160"
              width="45"
              height="40"
              rx="6"
              fill="#FFFFFF"
              animate={{ y: [160, 163, 160] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: 0.2 }}
            />
            <motion.rect
              x="215"
              y="160"
              width="45"
              height="40"
              rx="6"
              fill="#FFFFFF"
              animate={{ y: [160, 157, 160] }}
              transition={{ duration: 2.8, repeat: Infinity, delay: 0.4 }}
            />
          </svg>
        </div>
      );

    case 5:
      // Video 00:06: Dynamic animated crescent sweep curve / wave path with droplet accent particles
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Animated Dynamic Crescent / Wave Sweep (Video 00:06) */}
            <motion.path
              d="M190 110 C185 140, 150 170, 95 160 C125 155, 160 145, 175 110 C185 85, 195 95, 190 110 Z"
              fill="#FFFFFF"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [0.95, 1.05, 0.95],
                opacity: 1,
                rotate: [-4, 4, -4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Droplet particles accompanying the crescent (Video 00:06) */}
            <motion.circle
              cx="75"
              cy="148"
              r="4"
              fill="#FFFFFF"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <motion.circle
              cx="60"
              cy="142"
              r="3"
              fill="#FFFFFF"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
            />
            <motion.circle
              cx="50"
              cy="138"
              r="2"
              fill="#FFFFFF"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: 0.4 }}
            />

            {/* Timeline beat tick markers */}
            <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center px-4">
              {[1, 2, 3, 4, 5, 6].map((tick) => (
                <div key={tick} className="flex flex-col items-center gap-1">
                  <div className="w-1 h-3 bg-white/40 rounded-full" />
                  <span className="text-[9px] font-mono text-white/60">Sc.{tick}</span>
                </div>
              ))}
            </div>
          </svg>
        </div>
      );

    case 6:
      // Video 00:07-00:08: "Follow your own path" - continuous looping spline curve stroke drawing
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* The signature looping curve from Video 00:07 */}
            <motion.path
              d="M70 200 C 60 140, 110 80, 170 70 C 230 60, 260 110, 230 150 C 190 200, 100 160, 100 110 C 100 60, 180 50, 250 80"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{
                pathLength: [0, 1, 1],
                pathOffset: [0, 0, 1],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Camera Viewfinder framing corners */}
            <path d="M40 50 H60 V40 H30 V70 H40 Z" fill="rgba(255,255,255,0.4)" />
            <path d="M260 50 H240 V40 H270 V70 H260 Z" fill="rgba(255,255,255,0.4)" />
            <path d="M40 190 H60 V200 H30 V170 H40 Z" fill="rgba(255,255,255,0.4)" />
            <path d="M260 190 H240 V200 H270 V170 H260 Z" fill="rgba(255,255,255,0.4)" />

            <text
              x="150"
              y="220"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="600"
              letterSpacing="0.05em"
              className="opacity-90"
            >
              CAMERA KINEMATICS &amp; PACING
            </text>
          </svg>
        </div>
      );

    case 7:
      // Stage 7: Master Frame Nano Banana Pro - 16:9 lens viewfinder with rotating aperture & golden spiral
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 16:9 Master Frame Box */}
            <motion.rect
              x="45"
              y="45"
              width="210"
              height="118"
              rx="10"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              fill="rgba(255,255,255,0.06)"
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Golden Ratio spiral path */}
            <motion.path
              d="M150 104 C150 95, 140 85, 130 85 C115 85, 100 100, 100 120 C100 145, 125 160, 155 160 C190 160, 215 130, 215 95"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.5, repeat: Infinity, repeatType: 'reverse' }}
            />

            {/* Center Focus Crosshairs */}
            <motion.line
              x1="140"
              y1="104"
              x2="160"
              y2="104"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <motion.line
              x1="150"
              y1="94"
              x2="150"
              y2="114"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <motion.circle
              cx="150"
              cy="104"
              r="14"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="2 3"
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />

            <text
              x="150"
              y="190"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              letterSpacing="0.08em"
            >
              NANO BANANA PRO • 16:9 4K
            </text>
          </svg>
        </div>
      );

    case 8:
    default:
      // Stage 8: Video Prompt Agent Seedance - Flowing video prompt motion waves & kinetic tokens
      return (
        <div className="relative w-full h-44 sm:h-52 flex items-center justify-center overflow-hidden">
          <svg
            className="w-full h-full max-w-[280px]"
            viewBox="0 0 300 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* High-frequency cinematic motion wave */}
            <motion.path
              d="M40 120 Q 75 70, 110 120 T 180 120 T 250 120"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
              animate={{
                d: [
                  'M40 120 Q 75 70, 110 120 T 180 120 T 250 120',
                  'M40 120 Q 75 160, 110 120 T 180 120 T 250 120',
                  'M40 120 Q 75 70, 110 120 T 180 120 T 250 120',
                ],
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Secondary wave */}
            <motion.path
              d="M50 135 Q 95 100, 140 135 T 230 135"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              animate={{
                d: [
                  'M50 135 Q 95 100, 140 135 T 230 135',
                  'M50 135 Q 95 160, 140 135 T 230 135',
                  'M50 135 Q 95 100, 140 135 T 230 135',
                ],
              }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Prompt Seedance Tag Indicator */}
            <motion.rect
              x="90"
              y="50"
              width="120"
              height="26"
              rx="13"
              fill="rgba(255,255,255,0.15)"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <text
              x="150"
              y="67"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              SEEDANCE • READY
            </text>

            {/* Kinetic play arrow */}
            <motion.polygon
              points="145,170 162,180 145,190"
              fill="#F59E0B"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </svg>
        </div>
      );
  }
};
