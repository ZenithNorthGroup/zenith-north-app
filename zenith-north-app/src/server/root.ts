/**
 * ZENITH NORTH — Root Router
 * All tRPC routers registered here.
 */

import { router } from '@/lib/trpc'
import { clientsRouter, meRouter } from './routers/clients'
import { complianceRouter } from './routers/compliance'
import { workflowsRouter }  from './routers/workflows'
import { messagesRouter }   from './routers/messages'
import { importRouter }     from './routers/import'
import { auditRouter }      from './routers/audit'
import { tasksRouter }      from './routers/tasks'
import { documentsRouter }  from './routers/documents'
import { calendarRouter }   from './routers/calendar'
import { usersRouter }      from './routers/users'
import { settingsRouter }   from './routers/settings'
// Phase 2
import { wspRouter }        from './routers/wsp'
import { marketingRouter }  from './routers/marketing'
import { reviewsRouter }    from './routers/reviews'
import { incidentsRouter }  from './routers/incidents'
import { vendorsRouter }    from './routers/vendors'

import { credentialsRouter } from './routers/credentials'

export const appRouter = router({
  // Core
  clients:     clientsRouter,
  me:          meRouter,
  users:       usersRouter,
  settings:    settingsRouter,
  credentials: credentialsRouter,
  compliance: complianceRouter,
  workflows:  workflowsRouter,
  messages:   messagesRouter,
  import:     importRouter,
  audit:      auditRouter,
  tasks:      tasksRouter,
  documents:  documentsRouter,
  calendar:   calendarRouter,
  // Phase 2
  wsp:        wspRouter,
  marketing:  marketingRouter,
  reviews:    reviewsRouter,
  incidents:  incidentsRouter,
  vendors:    vendorsRouter,
})

export type AppRouter = typeof appRouter
