import { Brain, Eye, FileEdit, History, GripVertical, Sparkles, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  slug: string
  title: string
  shortDescription: string
  icon: LucideIcon
  column: string
}

export const features: NavItem[] = [
  {
    slug: 'ai-classification',
    title: 'AI Classification',
    shortDescription: 'Smart sorting free, AI sorting optional',
    icon: Brain,
    column: 'core'
  },
  {
    slug: 'watch-folders',
    title: 'Watch Folders',
    shortDescription: 'Automatically sort new files as they appear',
    icon: Eye,
    column: 'core'
  },
  {
    slug: 'smart-rename',
    title: 'Smart Rename',
    shortDescription: 'Content-based names from Your Claude; Smart Local tidies generic names',
    icon: FileEdit,
    column: 'core'
  },
  {
    slug: 'assistant',
    title: 'The Assistant',
    shortDescription: 'Your own Claude runs your Mac — one shortcut, approval before any change',
    icon: Sparkles,
    column: 'core'
  },
  {
    slug: 'sort-history',
    title: 'Sort History',
    shortDescription: 'Full operation log with undo support',
    icon: History,
    column: 'capabilities'
  },
  {
    slug: 'drag-and-drop',
    title: 'Drag & Drop Sorting',
    shortDescription: 'Drop a folder and sort in seconds',
    icon: GripVertical,
    column: 'capabilities'
  },
  {
    slug: 'privacy-offline',
    title: 'Your Data, Your Rules',
    shortDescription: 'Sorts on your device by default; AI sorting is opt-in',
    icon: ShieldCheck,
    column: 'platform'
  }
]
