"use client"

import React, { useState, useEffect, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select"
import { Checkbox } from "@/@/components/ui/checkbox"
import { cn } from "@/@/lib/utils"

interface MultiSelectProps {
  options: { id: string; name: string; disabled?: boolean }[]
  defaultValue?: string[]
  onValueChange: (value: string[]) => void
  placeholder: string
  className?: string
  value?: string[]
  ref?: any
}

export const CustomMultiSelect = React.forwardRef<any, MultiSelectProps>(
  ({ options, defaultValue, onValueChange, placeholder, className, value }, ref) => {
    const [selectedValues, setSelectedValues] = useState<string[]>(value || defaultValue || [])
    const [open, setOpen] = useState(false)
    const selectRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedValues(value || defaultValue || [])
    }, [value, defaultValue])

    const handleValueChange = (newValue: string[]) => {
      setSelectedValues(newValue)
      onValueChange(newValue)
    }

    const toggleOption = (optionId: string) => {
      let newValues = [...selectedValues]
      if (newValues.includes(optionId)) {
        newValues = newValues.filter((v) => v !== optionId)
      } else {
        newValues = [...newValues, optionId]
      }
      handleValueChange(newValues)
    }

    const updateSelectedValues = (newValues: string[]) => {
      setSelectedValues(newValues)
    }

    React.useImperativeHandle(ref, () => ({
      updateSelectedValues: updateSelectedValues,
    }))

    return (
      <div ref={selectRef}>
        <Select onOpenChange={setOpen} open={open} value={selectedValues.join(",")} onValueChange={(v) => {}}>
          <SelectTrigger className={cn("h-8 text-xs", className)}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]">
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`option-${option.id}`}
                  checked={selectedValues.includes(option.id)}
                  onCheckedChange={() => toggleOption(option.id)}
                  disabled={option.disabled}
                />
                <label
                  htmlFor={`option-${option.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.name}
                </label>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  },
)

CustomMultiSelect.displayName = "CustomMultiSelect"

