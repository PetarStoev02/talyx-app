const CATEGORY_CHART_BG: Record<string, string> = {
  Documents: 'bg-chart-1',
  Images: 'bg-chart-2',
  Videos: 'bg-chart-3',
  Audio: 'bg-chart-4',
  Code: 'bg-chart-5',
  Software: 'bg-chart-2',
  Archives: 'bg-chart-4',
  Other: 'bg-chart-5'
}

const CATEGORY_CHART_TEXT: Record<string, string> = {
  Documents: 'text-chart-1',
  Images: 'text-chart-2',
  Videos: 'text-chart-3',
  Audio: 'text-chart-4',
  Code: 'text-chart-5',
  Software: 'text-chart-2',
  Archives: 'text-chart-4',
  Other: 'text-chart-5'
}

export function getCategoryChartBg(category: string): string {
  return CATEGORY_CHART_BG[category] ?? CATEGORY_CHART_BG.Other
}

export function getCategoryChartText(category: string): string {
  return CATEGORY_CHART_TEXT[category] ?? CATEGORY_CHART_TEXT.Other
}
