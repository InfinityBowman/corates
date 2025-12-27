import { createFileRoute, Outlet } from '@tanstack/solid-router'
import Layout from '@/Layout.jsx'

export const Route = createFileRoute('/_app')({
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
})
