import { useEffect } from 'react'
import { LOAD_STAGES, useAppStore, type LoadProgress, type LoadStage } from '../../store/appStore'
import '../CourseSearch/PresetEditorModal.css'

const STEP_LABELS: Record<Exclude<LoadStage, 'done'>, string> = {
  reading: 'Read configuration file',
  searching: 'Search courses',
  courses: 'Populate course list',
  tabs: 'Rebuild analysis tabs',
  columns: 'Load columns',
}

const STEPS = LOAD_STAGES.filter((s): s is Exclude<LoadStage, 'done'> => s !== 'done')

/** Overall progress, 0..1: finished steps plus the share of columns loaded. */
export function loadFraction(progress: LoadProgress): number {
  if (progress.stage === 'done') return 1
  const index = STEPS.indexOf(progress.stage)
  const partial = progress.stage === 'columns' && progress.columnsTotal > 0
    ? progress.columnsDone / progress.columnsTotal
    : 0
  return (index + partial) / STEPS.length
}

/** Auto-close delay after a load that finished without problems. */
const AUTO_CLOSE_MS = 1200

/** Pop-up showing each step of loading a Trend Analysis configuration. */
export function LoadProgressModal() {
  const progress = useAppStore((s) => s.loadProgress)
  const close = useAppStore((s) => s.closeLoadProgress)
  const finishedCleanly = progress?.stage === 'done' && !progress.error && progress.warnings.length === 0

  useEffect(() => {
    if (!finishedCleanly) return
    const timer = window.setTimeout(close, AUTO_CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [finishedCleanly, close])

  if (!progress) return null
  const failed = Boolean(progress.error)
  const done = progress.stage === 'done'
  const currentIndex = progress.stage === 'done' ? STEPS.length : STEPS.indexOf(progress.stage)
  const percent = Math.round(loadFraction(progress) * 100)

  return (
    <div className="preset-modal__backdrop" role="presentation">
      <div className="preset-modal load-progress" role="dialog" aria-modal="true" aria-label={progress.title}>
        <h2 className="preset-modal__title">{progress.title}</h2>

        <div
          className={`load-progress__bar${failed ? ' load-progress__bar--error' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="load-progress__fill" style={{ width: `${percent}%` }} />
        </div>
        <div className={`load-progress__message${failed ? ' load-progress__message--error' : ''}`} aria-live="polite">
          {progress.error ?? progress.message}
        </div>

        <ol className="load-progress__steps">
          {STEPS.map((step, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? (failed ? 'error' : 'active') : 'pending'
            return (
              <li key={step} className={`load-progress__step load-progress__step--${state}`}>
                <span className="load-progress__icon" aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'error' ? '!' : state === 'active' ? '●' : '○'}
                </span>
                {STEP_LABELS[step]}
                {step === 'columns' && progress.columnsTotal > 0 && (
                  <span className="load-progress__count"> ({progress.columnsDone} of {progress.columnsTotal})</span>
                )}
              </li>
            )
          })}
        </ol>

        {progress.warnings.length > 0 && (
          <ul className="load-progress__warnings">
            {progress.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}

        {(done || failed) && (
          <div className="preset-modal__actions">
            <button className="btn btn--primary" onClick={close} autoFocus>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
