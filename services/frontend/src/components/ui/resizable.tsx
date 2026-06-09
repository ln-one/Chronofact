import { GripVertical } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof Panel>) {
  return <Panel {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      className={cn(
        'relative flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-border/80 transition-colors hover:bg-primary/20 active:bg-primary/30 data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className='z-10 flex h-5 w-4 items-center justify-center rounded-sm border bg-background shadow-sm data-[panel-group-direction=vertical]:h-4 data-[panel-group-direction=vertical]:w-5'>
          <GripVertical className='h-2.5 w-2.5' />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
