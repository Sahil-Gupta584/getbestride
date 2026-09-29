import { createFileRoute } from '@tanstack/react-router'
import { Card } from '#/components/ui/card'

export const Route = createFileRoute('/_protected/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">Welcome to your workspace.</p>
      </div>

      <Card className="p-8 text-center">
        <Card.Content className="space-y-2">
          <p className="text-sm text-gray-500">No forms — seed and form routes removed. Add your SaaS widgets here.</p>
        </Card.Content>
      </Card>
    </div>
  )
}
