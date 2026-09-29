import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { QuotesPage } from '#/components/quotes-page'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    pickupLat: z.coerce.number().min(-90).max(90).optional(),
    pickupLng: z.coerce.number().min(-180).max(180).optional(),
    pickupLabel: z.string().max(500).optional(),
    dropLat: z.coerce.number().min(-90).max(90).optional(),
    dropLng: z.coerce.number().min(-180).max(180).optional(),
    dropLabel: z.string().max(500).optional(),
  }),
  component: QuotesPage,
})
