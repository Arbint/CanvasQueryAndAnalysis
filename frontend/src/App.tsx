import { ReactFlowProvider } from '@xyflow/react'
import { ResizableColumns } from './components/layout/ResizableColumns'
import { CourseSearch } from './components/CourseSearch/CourseSearch'
import { WorkingArea } from './components/WorkingArea/WorkingArea'
import { StudentList } from './components/StudentList/StudentList'
import './App.css'

export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <img
          src="/assets/uiw3d_Logo_PNG_White.png"
          alt="UIW"
          className="app__logo"
        />
        <span className="app__title">Canvas Query &amp; Analysis</span>
      </header>
      <main className="app__main">
        <ReactFlowProvider>
          <ResizableColumns
            left={<CourseSearch />}
            center={<WorkingArea />}
            right={<StudentList />}
          />
        </ReactFlowProvider>
      </main>
    </div>
  )
}
