/**
 * ZENITH NORTH — Root Router
 * Combines all sub-routers into one app router.
 */

import { router } from '@/lib/trpc'
import { clientsRouter }    from './routers/clients'
import { complianceRouter } from './routers/compliance'
import { workflowsRouter }  from './routers/workflows'
import { messagesRouter }   from './routers/messages'
import { importRouter }     from './routers/import'
import { auditRouter }      from './routers/audit'
import { tasksRouter }      from './routers/tasks'
import { documentsRouter }  from './routers/documents'

export const appRouter = router({
  clients:    clientsRouter,
  compliance: complianceRouter,
  workflows:  workflowsRouter,
  messages:   messagesRouter,
  import:     importRouter,
  audit:      auditRouter,
  tasks:      tasksRouter,
  documents:  documentsRouter,
})

export type AppRouter = typeof appRouter
