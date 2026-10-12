import { access } from 'fs/promises'
import { join, basename } from 'path'
import { z } from 'zod/v4'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ClassifiedFile } from '../../domain/sorting/services/SortExecutor'

export interface AiClassification {
  path: string
  category: string
  subcategory: string | null
  suggestedName: string | null
}

export interface SortPlanEntry {
  path: string
  name: string
  category: string
  subcategory: string | null
  suggestedName: string | null
  semanticPath: string
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function buildSortPlan(
  files: AiClassification[]
): Promise<{ plan: SortPlanEntry[]; skipped: string[] }> {
  const plan: SortPlanEntry[] = []
  const skipped: string[] = []

  for (const file of files) {
    const exists = await pathExists(file.path)
    if (!exists) {
      skipped.push(file.path)
      continue
    }

    const name = basename(file.path)
    const subPath = file.subcategory ? join(file.category, file.subcategory) : file.category

    plan.push({
      path: file.path,
      name,
      category: file.category,
      subcategory: file.subcategory,
      suggestedName: file.suggestedName,
      semanticPath: subPath
    })
  }

  return { plan, skipped }
}

export function toClassifiedFiles(plan: SortPlanEntry[]): ClassifiedFile[] {
  return plan.map((entry) => ({
    path: entry.path,
    name: entry.name,
    size: 0,
    classification: {
      category: entry.category as ClassifiedFile['classification']['category'],
      subcategory: entry.subcategory,
      confidence: 1.0,
      metadata: {},
      semanticPath: entry.semanticPath.split('/'),
      suggestedName: entry.suggestedName
    }
  }))
}

export function registerClassifyFiles(server: McpServer): void {
  server.tool(
    'classify_files',
    'Build a sort plan from AI-provided classifications. Validates that files exist and constructs destination paths.',
    {
      files: z.array(
        z.object({
          path: z.string().describe('Absolute path to the file'),
          category: z.string().describe('Top-level category (e.g. Documents, Images)'),
          subcategory: z.string().nullable().describe('Subcategory (e.g. Photos, Invoices)'),
          suggestedName: z
            .string()
            .nullable()
            .describe('AI-suggested rename for the file, or null to keep original')
        })
      )
    },
    async ({ files }) => {
      const result = await buildSortPlan(files)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
      }
    }
  )
}
