import { createContext, useContext, useMemo } from 'react'
import type { Course } from '../../api/types'
import { courseInScope, hasScope, type GraphScope } from '../../lib/graphEvaluation'
import { useAppStore } from '../../store/appStore'

/**
 * The Terms / Department of the Trend Analysis card whose graph is being
 * edited. Nodes only consider courses within it, matching how the card runs
 * the graph, so collecting while configuring fetches fewer courses.
 * Null (the Aggregation Graph tab): every searched course.
 */
export const GraphScopeContext = createContext<GraphScope | null>(null)

/** The searched courses the nodes of this graph may use. */
export function useScopedCourses(): Course[] {
  const courses = useAppStore((s) => s.courses)
  const scope = useContext(GraphScopeContext)
  return useMemo(
    () => (hasScope(scope) ? courses.filter((c) => courseInScope(c, scope)) : courses),
    [courses, scope],
  )
}
