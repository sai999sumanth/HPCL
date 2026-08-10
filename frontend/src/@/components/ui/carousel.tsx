
// Carousel.tsx
import * as React from "react"
import { EmblaOptionsType } from 'embla-carousel'
import useEmblaCarousel from 'embla-carousel-react'

type CarouselProps = {
  opts?: EmblaOptionsType
  className?: string
  children?: React.ReactNode
  plugins?: any[]
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export function Carousel({
  opts,
  className,
  children,
  plugins,
  onMouseEnter,
  onMouseLeave,
  ...props
}: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    slidesToScroll: 1,
    align: 'start',
    ...opts
  }, plugins)

  return (
    <div
      ref={emblaRef}
      className={`overflow-hidden ${className}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...props}
    >
      {children}
    </div>
  )
}

// CarouselContent.tsx
export function CarouselContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={`flex ${className}`} 
      {...props}
    >
      {children}
    </div>
  )
}

// CarouselItem.tsx
export function CarouselItem({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={`flex-0 flex-shrink-0 w-full pl-4 ${className}`} 
      {...props}
    >
      {children}
    </div>
  )
}

// CarouselPrevious.tsx
export function CarouselPrevious({
  className,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`absolute left-1 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-md ${className}`}
      {...props}
    >
      Previous
    </button>
  )
}

// CarouselNext.tsx
export function CarouselNext({
  className,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`absolute right-1 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow-md ${className}`}
      {...props}
    >
      Next
    </button>
  )
}