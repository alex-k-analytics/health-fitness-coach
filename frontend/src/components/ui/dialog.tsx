import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const DialogFocusContext = React.createContext<React.MutableRefObject<HTMLElement | null> | null>(null)

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

function Dialog({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
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
    <DialogFocusContext.Provider value={triggerRef}>
      <DialogPrimitive.Root data-slot="dialog" onOpenChange={handleOpenChange} {...props} />
    </DialogFocusContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ ...props }, ref) => {
  const focusContext = React.useContext(DialogFocusContext)
  const setFocusTriggerRef = React.useCallback(
    (node: React.ElementRef<typeof DialogPrimitive.Trigger> | null) => {
      if (focusContext) {
        focusContext.current = node as HTMLElement | null
      }
    },
    [focusContext]
  )

  return (
    <DialogPrimitive.Trigger
      ref={composeRefs(ref, setFocusTriggerRef)}
      data-slot="dialog-trigger"
      {...props}
    />
  )
})
DialogTrigger.displayName = "DialogTrigger"

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ ...props }, ref) => (
  <DialogPrimitive.Close ref={ref} data-slot="dialog-close" {...props} />
))
DialogClose.displayName = "DialogClose"

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({
  className,
  ...props
}, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
  }
>(({
  className,
  children,
  showCloseButton = true,
  ...props
}, ref) => {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          "fixed top-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-4 overflow-hidden border bg-background px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-[calc(100%-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6 sm:shadow-lg sm:max-w-lg",
          className
        )}
        {...props}
       >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = "DialogContent"

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({
  className,
  ...props
}, ref) => {
  return (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
})
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({
  className,
  ...props
}, ref) => {
  return (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
