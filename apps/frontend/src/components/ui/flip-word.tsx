"use client"

import { AnimatePresence, motion } from "motion/react"
import * as React from "react"
import { cn } from "@/lib/utils"

type FlipWordsProps = Omit<React.ComponentProps<"span">, "children"> & {
  words: string[]
  duration?: number
  letterDelay?: number
  wordDelay?: number
}

function FlipWords({
  ref,
  words,
  duration = 3000,
  letterDelay = 0.05,
  wordDelay = 0.3,
  className,
  ...props
}: FlipWordsProps) {
  const localRef = React.useRef<HTMLSpanElement>(null)
  React.useImperativeHandle(ref as any, () => localRef.current as HTMLSpanElement)

  const [currentWord, setCurrentWord] = React.useState(words[0] ?? "")
  const [isAnimating, setIsAnimating] = React.useState<boolean>(false)

  const startAnimation = React.useCallback(() => {
    const word = words[words.indexOf(currentWord) + 1] || words[0] || ""
    setCurrentWord(word)
    setIsAnimating(true)
  }, [currentWord, words])

  React.useEffect(() => {
    if (!isAnimating) {
      const timeoutId = setTimeout(() => {
        startAnimation()
      }, duration)
      return () => clearTimeout(timeoutId)
    }
  }, [isAnimating, duration, startAnimation])

  return (
    <span data-slot="flip-words" ref={localRef} {...(props as any)}>
      <AnimatePresence
        onExitComplete={() => {
          setIsAnimating(false)
        }}
      >
        <motion.span
          animate={{
            opacity: 1,
            y: 0,
          }}
          className={cn(
            "inline-block relative text-left px-2 will-change-transform will-change-opacity will-change-filter",
            className,
          )}
          exit={{
            opacity: 0,
            y: -40,
            x: 40,
            filter: "blur(8px)",
            scale: 2,
            position: "absolute",
          }}
          initial={{
            opacity: 0,
            y: 10,
          }}
          key={currentWord}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 10,
          }}
        >
          {currentWord.split(" ").map((word, wordIndex) => (
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="inline-block whitespace-nowrap"
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              key={`${word}-${wordIndex}`}
              transition={{
                delay: wordIndex * wordDelay,
                duration: 0.3,
              }}
            >
              {word.split("").map((letter, letterIndex) => (
                <motion.span
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className="inline-block will-change-transform will-change-opacity will-change-filter"
                  initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                  key={`${word}-${letterIndex}`}
                  transition={{
                    delay: wordIndex * wordDelay + letterIndex * letterDelay,
                    duration: 0.2,
                  }}
                >
                  {letter}
                </motion.span>
              ))}
              <span className="inline-block">&nbsp;</span>
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export { FlipWords, type FlipWordsProps }
export default FlipWords
