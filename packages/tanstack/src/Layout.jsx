import { createSignal, onMount } from 'solid-js'
import Navbar from './components/Navbar.jsx'
import Sidebar from './components/sidebar/Sidebar.jsx'
import { Toaster } from '@corates/ui'
import { ImpersonationBanner } from '@/components/admin/index.js'
import { isImpersonating } from '@/stores/adminStore.js'

const SIDEBAR_STORAGE_KEY = 'corates-sidebar-open'

export default function MainLayout(props) {
  // Initialize sidebar state from localStorage, default to closed
  const [sidebarOpen, setSidebarOpen] = createSignal(false)

  onMount(() => {
    const storedOpen = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (storedOpen !== null) {
      setSidebarOpen(storedOpen === 'true')
    }
    // Default to closed if no stored preference
  })

  const toggleSidebar = () => {
    const newValue = !sidebarOpen()
    setSidebarOpen(newValue)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue))
  }

  return (
    <div
      class={`flex h-screen flex-col overflow-hidden bg-blue-50 ${isImpersonating() ? 'pt-10' : ''}`}
    >
      <ImpersonationBanner />
      <Navbar open={sidebarOpen()} toggleSidebar={toggleSidebar} />
      <div class="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen()} />
        <main class="flex-1 overflow-auto text-gray-900">{props.children}</main>
      </div>
      <Toaster />
    </div>
  )
}
