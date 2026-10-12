import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Sparkles } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn, formatBytes } from '@shared/lib/utils'
import { getCategoryChartText } from '@shared/lib/categoryChart'
import { useLanguage } from '@app/providers/useLanguage'
import { useSortSession } from '@app/providers/useSortSession'
import type { ClassifiedFile } from '@shared/api/ipc'

interface PreviewTreeProps {
  files: ClassifiedFile[]
  selectedPath: string | null
  onSelect: (path: string) => void
  /** When set, only these files appear — the plan's counts double as filters. */
  filterPaths?: Set<string> | null
}

/** Sentinel the rename panel writes to reject every suggestion at once. */
const ALL_REJECTED = '__ALL_REJECTED__'

const ROW_HEIGHT = 32

interface TreeNode {
  /** What the file will be called after sorting — the outcome, not today's name. */
  name: string
  /** Today's name, kept only when the file is being renamed. */
  oldName: string | null
  type: 'folder' | 'file'
  children: TreeNode[]
  file?: ClassifiedFile
  fileCount: number
  hasAiClassified: boolean
}

function buildPreviewTree(
  classified: ClassifiedFile[],
  approvedRenames: Record<string, string>,
  rejectedRenames: Set<string>
): TreeNode {
  const root: TreeNode = {
    name: 'Output',
    oldName: null,
    type: 'folder',
    children: [],
    fileCount: 0,
    hasAiClassified: false
  }
  const allRejected = rejectedRenames.has(ALL_REJECTED)

  for (const file of classified) {
    const c = file.classification
    let segments: string[]

    if (c.semanticPath && c.semanticPath.length > 0) {
      segments = c.semanticPath
    } else {
      segments = [c.category]
      if (c.subcategory) segments.push(c.subcategory)
    }

    // AI-classified files have confidence > 0.7 and entities or suggestedName from AI
    const isAi = c.confidence > 0.7 && (!!c.entities || !!c.suggestedName)

    // Navigate/create folder nodes
    let current = root
    for (const seg of segments) {
      let child = current.children.find((n) => n.type === 'folder' && n.name === seg)
      if (!child) {
        child = {
          name: seg,
          oldName: null,
          type: 'folder',
          children: [],
          fileCount: 0,
          hasAiClassified: false
        }
        current.children.push(child)
      }
      current = child
    }

    // Add file node. A suggested rename is shown as the outcome even before it
    // is approved: the plan has to read as what will happen, not what is.
    const suggested = allRejected || rejectedRenames.has(file.path) ? null : c.suggestedName
    const newName = approvedRenames[file.path] ?? suggested ?? null
    current.children.push({
      name: newName ?? file.name,
      oldName: newName && newName !== file.name ? file.name : null,
      type: 'file',
      children: [],
      file,
      fileCount: 0,
      hasAiClassified: isAi
    })
  }

  // Calculate file counts and propagate AI flag up
  function countFiles(node: TreeNode): number {
    if (node.type === 'file') return 1
    node.fileCount = node.children.reduce((sum, child) => sum + countFiles(child), 0)
    node.hasAiClassified = node.children.some((child) => child.hasAiClassified)
    return node.fileCount
  }
  countFiles(root)

  // Sort: folders first, then files, alphabetically within each group
  function sortTree(node: TreeNode): void {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortTree)
  }
  sortTree(root)

  return root
}

interface FlatRow {
  node: TreeNode
  depth: number
  /** Segment path for folders, absolute file path for files */
  id: string
}

function flattenTree(root: TreeNode, collapsed: Set<string>): FlatRow[] {
  const rows: FlatRow[] = []
  function walk(node: TreeNode, depth: number, parentId: string): void {
    for (const child of node.children) {
      const folderId = parentId ? `${parentId}/${child.name}` : child.name
      if (child.type === 'file') {
        rows.push({ node: child, depth, id: child.file?.path ?? folderId })
      } else {
        rows.push({ node: child, depth, id: folderId })
        if (!collapsed.has(folderId)) walk(child, depth + 1, folderId)
      }
    }
  }
  walk(root, 0, '')
  return rows
}

/** Virtualized preview of the output folder structure; file rows are selectable. */
export function PreviewTree({
  files,
  selectedPath,
  onSelect,
  filterPaths = null
}: PreviewTreeProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const tc = useLanguage((s) => s.tc)
  const approvedRenames = useSortSession((s) => s.approvedRenames)
  const rejectedRenames = useSortSession((s) => s.rejectedRenames)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const parentRef = useRef<HTMLDivElement>(null)

  const tree = useMemo(() => {
    const shown = filterPaths ? files.filter((f) => filterPaths.has(f.path)) : files
    return buildPreviewTree(shown, approvedRenames, rejectedRenames)
  }, [files, approvedRenames, rejectedRenames, filterPaths])
  const rows = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  function toggleFolder(id: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="relative h-full">
      <div ref={parentRef} className="h-full overflow-auto px-2 py-2">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const { node, depth, id } = rows[virtualRow.index]

            if (node.type === 'file') {
              const isSelected = node.file != null && node.file.path === selectedPath
              return (
                <button
                  key={id}
                  onClick={() => node.file && onSelect(node.file.path)}
                  className={cn(
                    'absolute left-0 flex w-full items-center gap-2 rounded text-left text-sm text-foreground/80 transition-colors',
                    isSelected ? 'bg-accent text-foreground' : 'hover:bg-accent/50'
                  )}
                  style={{
                    paddingLeft: depth * 20 + 24,
                    height: ROW_HEIGHT,
                    top: virtualRow.start
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span className="truncate" title={node.name}>
                    {node.name}
                  </span>
                  {node.oldName && (
                    <span
                      className="shrink-0 truncate text-[11px] text-muted-foreground"
                      title={node.oldName}
                    >
                      {t('sort.was')} {node.oldName}
                    </span>
                  )}
                  {node.file && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatBytes(node.file.size)}
                    </span>
                  )}
                </button>
              )
            }

            const isExpanded = !collapsed.has(id)
            const categoryColorClass = getCategoryChartText(node.name)
            return (
              <button
                key={id}
                onClick={() => toggleFolder(id)}
                className="absolute left-0 flex w-full items-center gap-1.5 rounded text-left text-sm hover:bg-accent/50 transition-colors"
                style={{ paddingLeft: depth * 20 + 4, height: ROW_HEIGHT, top: virtualRow.start }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen className={cn('h-4 w-4 shrink-0', categoryColorClass)} />
                ) : (
                  <Folder className={cn('h-4 w-4 shrink-0', categoryColorClass)} />
                )}
                <span className="font-medium text-foreground capitalize">{tc(node.name)}</span>
                {node.hasAiClassified && (
                  <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium bg-accent text-foreground">
                    <Sparkles className="h-2.5 w-2.5" />
                    {t('sort.aiSubcategory')}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-1">
                  {node.fileCount} {node.fileCount !== 1 ? t('sort.files') : t('sort.file')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
