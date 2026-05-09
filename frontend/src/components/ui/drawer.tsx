"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

const DrawerFocusContext = React.createContext<React.MutableRefObject<HTMLElement | null> | null>(null)

function composeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return

      if (typeof ref === "function") {
        ref(node)
        return
      }

      ;(ref as React.MutableRefObject<T | null>).current = node
    })
  }
}

function Drawer({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const triggerRef = React.useRef<HTMLElement | null>(null)

  const restoreTriggerFocus = React.useCallback(() => {
    const focusTrigger = () => triggerRef.current?.focus({ preventScroll: true })

    triggerRef.current?.focus({ preventScroll: true })
    window.requestAnimationFrame(focusTrigger)
    window.setTimeout(focusTrigger, 50)
  }, [])

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      onOpenChange?.(open)
      if (!open) restoreTriggerFocus()
    },
    [onOpenChange, restoreTriggerFocus]
  )

  return (
    <DrawerFocusContext.Provider value={triggerRef}>
      <DrawerPrimitive.Root data-slot="drawer" onOpenChange={handleOpenChange} {...props} />
    </DrawerFocusContext.Provider>
  )
}

const DrawerTrigger = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Trigger>
>(({ ...props }, ref) => {
  const focusContext = React.useContext(DrawerFocusContext)
  const setFocusTriggerRef = React.useCallback(
    (node: React.ElementRef<typeof DrawerPrimitive.Trigger> | null) => {
      if (focusContext) {
        focusContext.current = node as HTMLElement | null
      }
    },
    [focusContext]
  )

  return (
    <DrawerPrimitive.Trigger
      ref={composeRefs(ref, setFocusTriggerRef)}
      data-slot="drawer-trigger"
      {...props}
    />
  )
})
DrawerTrigger.displayName = "DrawerTrigger"

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

const DrawerClose = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Close>
>(({ ...props }, ref) => (
  <DrawerPrimitive.Close ref={ref} data-slot="drawer-close" {...props} />
))
DrawerClose.displayName = "DrawerClose"

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({
  className,
  ...props
}, ref) => {
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
})
DrawerOverlay.displayName = "DrawerOverlay"

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({
  className,
  children,
  ...props
}, ref) => {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-background",
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=top]:border-border",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=bottom]:border-border",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:border-border data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:border-border data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
})
DrawerContent.displayName = "DrawerContent"

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({
  className,
  ...props
}, ref) => {
  return (
    <DrawerPrimitive.Title
      ref={ref}
      data-slot="drawer-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
})
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({
  className,
  ...props
}, ref) => {
  return (
    <DrawerPrimitive.Description
      ref={ref}
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
DrawerDescription.displayName = "DrawerDescription"

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
