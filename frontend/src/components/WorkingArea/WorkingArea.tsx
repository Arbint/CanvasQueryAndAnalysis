import { useState } from 'react'
import { NodeGraph } from '../NodeGraph/NodeGraph'
import { TrendAnalysis } from '../TrendAnalysis/TrendAnalysis'
import './WorkingArea.css'

type WorkTab = 'aggregation' | 'trend'

export function WorkingArea() {
  const [activeTab, setActiveTab] = useState<WorkTab>('aggregation')

  return (
    <div className="working-area">
      <div className="working-area__tabs" role="tablist" aria-label="Working area">
        <button
          className={`working-area__tab${activeTab === 'aggregation' ? ' working-area__tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'aggregation'}
          onClick={() => setActiveTab('aggregation')}
        >
          Aggregation Graph
        </button>
        <button
          className={`working-area__tab${activeTab === 'trend' ? ' working-area__tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'trend'}
          onClick={() => setActiveTab('trend')}
        >
          Trend Analysis
        </button>
      </div>
      <div className="working-area__content">
        <div className={activeTab === 'aggregation' ? 'working-area__panel working-area__panel--active' : 'working-area__panel'}>
          <NodeGraph />
        </div>
        <div className={activeTab === 'trend' ? 'working-area__panel working-area__panel--active' : 'working-area__panel'}>
          <TrendAnalysis />
        </div>
      </div>
    </div>
  )
}
