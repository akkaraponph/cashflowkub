"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Radix forbids empty item values, so the optional "clear" item uses a sentinel that maps back to "".
const CLEAR = "__clear__"

export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

type SelectProps = Omit<React.ComponentProps<typeof SelectPrimitive.Trigger>, "value" | "defaultValue" | "children"> & {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  onOpenChange?: (open: boolean) => void
  /** Shown while no option is chosen. */
  placeholder?: React.ReactNode
  /** Adds a first item with this label that resets the value to "". */
  clearLabel?: string
  /** Form field name: renders a hidden native input so plain <form> submits keep working. */
  name?: string
  /** "cell" is the borderless, dense look for spreadsheet grids. */
  variant?: "default" | "cell"
}

/** Themed dropdown used everywhere instead of a native <select>. */
function Select({
  options, value, defaultValue, onValueChange, onOpenChange, placeholder, clearLabel, name, variant = "default", className, disabled, ...props
}: SelectProps) {
  const cell = variant === "cell"
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v === CLEAR ? "" : v)}
      onOpenChange={onOpenChange}
      name={name}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-1.5 text-left whitespace-nowrap transition-colors outline-none data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate",
          cell
            ? "h-7 rounded-none border-0 bg-transparent px-1.5 text-xs focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
            : "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:border-ring aria-invalid:border-destructive dark:bg-input/30",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className={cn("shrink-0 text-muted-foreground", cell ? "size-3.5" : "size-4")} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className="z-[60] max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <SelectPrimitive.Viewport className="max-h-72 p-1">
            {clearLabel ? <SelectItem option={{ value: CLEAR, label: clearLabel }} cell={cell} muted /> : null}
            {options.map((o) => <SelectItem key={o.value} option={o} cell={cell} />)}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function SelectItem({ option, cell, muted }: { option: SelectOption; cell: boolean; muted?: boolean }) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      disabled={option.disabled}
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center rounded-md py-1.5 pr-7 pl-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        cell ? "text-xs" : "text-sm",
        muted && "text-muted-foreground"
      )}
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <CheckIcon className="size-3.5" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export { Select }
