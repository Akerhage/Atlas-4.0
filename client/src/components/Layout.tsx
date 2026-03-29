import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import ToastContainer from './ToastContainer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content-area">
        {children}
      </main>
      <ToastContainer />
    </div>
  )
}
