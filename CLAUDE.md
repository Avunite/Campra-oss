# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
pnpm dev              # Start development servers (backend + frontend with hot reload)
pnpm build            # Build all packages + run gulp tasks
pnpm start            # Start production server
pnpm start:test        # Start test server
```

### Database
```bash
pnpm migrate          # Run TypeORM migrations
pnpm revertmigration  # Revert last migration
```

### Testing (Three-Tier System)
```bash
# Simple tests (RECOMMENDED) - No database required, fastest
pnpm test:simple test/your-test-file.test.js

# Vitest with mocked database - Advanced features, no DB connection
pnpm test:no-db

# Full integration tests - Real database connection required
pnpm test
```

### Code Quality
```bash
pnpm lint             # Run ESLint across all packages
pnpm format           # Format code with gulp
pnpm clean            # Clean build directories
```

## Architecture Overview

Campra V4 is a **school-centric social platform** built as a TypeScript monorepo using pnpm workspaces.

### Core Architecture
- **Monorepo**: `packages/backend/` (Node.js), `packages/client/` (Vue.js), `packages/sw/` (service worker)
- **Cluster-based backend**: Master/worker process architecture (see `packages/backend/src/boot/index.ts`)
- **Database**: PostgreSQL with TypeORM and PostGIS for spatial queries
- **Job Processing**: Redis with Bull queues
- **Configuration**: Loaded from `.config/default.yml` (or `test.yml` for tests)

### School-Centric Design
This platform is built around **schools as organizational units** with:
- Billing and subscription management via Stripe
- Student cap enforcement and CSV import with domain verification
- Multi-level moderation (school-level and platform-level)
- **Proximity boost algorithm**: Posts from nearby schools get algorithmic prioritization using PostGIS spatial queries
- LMS integration capabilities with automatic token refresh

## Key Patterns

### API Endpoints Structure
All endpoints in `packages/backend/src/server/api/endpoints/` follow this pattern:

```typescript
export const meta = {
  tags: ['notes'],
  requireCredential: true,
  requireSchoolAdmin: true,  // School-specific auth
  limit: { duration: HOUR, max: 300 },
  kind: 'write:notes',
} as const;

export const paramDef = { /* schema */ } as const;

export default define(meta, paramDef, async (ps, user) => {
  // Handler implementation
});
```

Endpoints are **auto-registered** based on file structure. The `meta` object defines auth, rate limits, and permissions. Use `ApiError` for consistent error handling with predefined error codes.

### Database Access
- **TypeORM entities** in `src/models/entities/`
- **Custom repositories** in `src/models/repositories/` (extend base functionality)
- **Centralized exports** in `src/models/index.ts`
- Import alias: `@/models` maps to `src/models`
- Always use repository methods rather than direct entity manager queries when possible

### Services Pattern
Business logic lives in `src/services/` with dedicated loggers:

```typescript
import Logger from './logger.js';
export const logger = new Logger('service-name');
```

Each service should have its own logger instance for debugging and monitoring.

### School-School Features
When working with school features, understand these key concepts:
- **Proximity scoring**: Same school (1.0), nearby schools (0.7), distant schools (0.0)
- **School billing**: Stripe integration tracks student caps and subscription status
- **School domains**: Email domain verification for student accounts
- **School moderation**: Content can be moderated at school level or escalated to platform level

## Frontend Architecture

### Vue.js 3 Patterns
- **Composition API** with TypeScript throughout
- **Custom NIRAX router** (not Vue Router) - defined in `src/router.ts`
- **Pizzax store**: Reactive localStorage-based state management
- **Global components**: Auto-registered from `src/components/global/`

### Build System
- **Vite** for frontend builds with manual chunk splitting
- **Vendor chunks**: Vue, Chart.js, TensorFlow.js split separately
- **SWC compiler** for fast TypeScript compilation in backend
- **Node flags**: `--experimental-specifier-resolution=node` and `--experimental-vm-modules`

## Testing Guidelines

### Prefer Simple Tests
Use the simple test runner (`pnpm test:simple`) for most new tests. It provides:
- `describe`, `test`/`it`, `expect`, `beforeEach`/`afterEach`
- Mock functions with `vi.fn()` compatible interface
- No database setup required
- Fastest execution time

See `packages/backend/test/README.md` for detailed testing patterns.

### Test Location
Place tests in `packages/backend/test/` directory. Test setup files:
- `test/simple-runner.js` - Custom lightweight test runner
- `test/setup-no-db.js` - Vitest setup with mocked dependencies

## Critical Integrations

### Stripe
- **StripeSchoolManager** service for centralized operations
- School subscriptions with custom pricing models
- Payment method collection via setup intents
- Webhooks handled in `/stripe/` endpoints

### Content Moderation
- **Iffy webhook** integration for content flagging
- NSFW detection using TensorFlow.js
- Two-tier moderation: school-level and platform-level escalation

### Media Processing
- **Sharp** for images with blurhash generation
- **FFmpeg** for video transcoding
- **Object storage**: AWS S3 compatible APIs

### Neural Network Recommendation
Content ranking uses an 11-feature neural network (`src/services/note/algo.ts`):
- Social signals (follows, reactions, shares)
- Time-based decay for freshness
- **Proximity score** based on school location (same school: 1.0, nearby: 0.7)

## Configuration Patterns

### Environment Setup
- Config files in `.config/` directory
- **Mixin pattern** in `config/load.ts` adds computed properties (URLs, user agent)
- Redis prefix automatically set to hostname
- Use `NODE_ENV=testing` for test environment

### Import Aliases
- `@/` maps to `src/` in both frontend and backend
- Configured in each package's `tsconfig.json`

## Development Workflow

### Before Starting Work
1. Ensure dependencies are installed: `pnpm install`
2. Check if migration is needed: `pnpm migrate`
3. Start dev server: `pnpm dev`

### Creating New Features
1. **API endpoints**: Add to `src/server/api/endpoints/` following the pattern
2. **Database changes**: Create TypeORM migration (MUST be .js file, not .ts), update entities if needed
3. **Services**: Add business logic to `src/services/`
4. **Frontend**: Use Composition API, DO NOT import global components
5. **School-admin pages**: Add to `menuDef` in `src/pages/school-admin/index.vue` AND register route in `src/router.ts`

### Common Gotchas
- **Migration files**: MUST be `.js` files, never `.ts` - TypeORM CLI only loads .js files
- **Global components**: NEVER import global components (MkLoading, MkError, etc.) - they're auto-registered
- **School context**: Many operations require school verification - check `requireSchoolAdmin` in endpoint meta
- **Proximity features**: Remember PostGIS spatial queries require proper coordinate data
- **Rate limiting**: All write operations should have appropriate rate limits in endpoint meta
- **Error handling**: Use `ApiError` with proper error codes for API responses
- **Logging**: Always use the service-specific logger, never console.log in production code
- **TypeORM JSONB queries**: Use query builder with proper syntax: `createQueryBuilder().where("metadata->'lms'->>'field' = :value", { value })`
- **String literals in Vue**: Never break string literals across lines in templates - use single-line strings only

## LMS Integration Notes

The platform has LMS synchronization capabilities that require careful handling:
- Access tokens are automatically refreshed when expired
- Student synchronization must prevent cross-school data collisions
- LMS schools have special billing and verification requirements
- Recent changes (commit af805fe) improved token refresh and collision prevention
- **LMS scheduled jobs**: Hourly auto-sync runs from `src/queue/processors/system/lms-sync.ts`
- **Token refresh**: Handled automatically when LMS API calls return 401 errors

### Supported LMS Platforms

**Currently Implemented:**
- ✅ **OneRoster** (via `OneRosterAdapter`) - Universal standard supported by many platforms

**Planned/Placeholder Support:**
- 🔄 Canvas (can use OneRoster)
- 🔄 Blackbaud (can use OneRoster)
- 🔄 Schoology (can use OneRoster)
- 🔄 PowerSchool (can use OneRoster)
- 📋 Google Classroom
- 📋 Microsoft Teams for Education
- 📋 Moodle
- 📋 Brightspace/D2L
- 📋 Sakai

**Note**: Many LMS platforms (Canvas, Blackbaud, Schoology, PowerSchool) support the OneRoster standard, so they can be integrated using the existing OneRoster adapter by selecting "OneRoster" as the LMS type and using the appropriate OneRoster API endpoint.

### LMS Adapter Development & Testing

**Testing OneRoster Integration:**
- Use [ClassLink OneRoster Sandbox](https://sandbox-demo-v2.oneroster.com/ims/oneroster/v1p1) for API testing (v1.1/v1.2)
- Use [ClassLink Admin Sandbox](https://sandbox-vn-v2.oneroster.com/adminAPI) for admin operations (v1.3N)
- Local mock server available at [GitHub: oneroster-api-mock](https://github.com/vossenv/oneroster-api-mock)

**Adapter Implementation Pattern:**
```typescript
// All adapters must extend BaseLMSAdapter
export class CustomLMSAdapter extends BaseLMSAdapter {
  async getStudents(): Promise<LMSStudent[]> { /* implementation */ }
  async testConnection(): Promise<boolean> { /* implementation */ }
  async refreshToken(): Promise<void> { /* OAuth2 refresh */ }
  getCredentials(): LMSCredentials { /* Return current tokens */ }
}
```

**Important**: Always test token refresh logic - many LMS APIs return 401 when access tokens expire (typically 1 hour).

### LMS Adapter Architecture

All LMS adapters extend `BaseLMSAdapter` and implement:
- `getStudents()` - Fetch student roster
- `testConnection()` - Verify API credentials
- `refreshToken()` - Handle OAuth token refresh
- `getCredentials()` - Return current auth tokens

Adapters are created via `LMSService.createAdapter()` based on `school.metadata.lms.type`.

## School Admin Pages

### Page Structure Pattern
All school-admin pages follow consistent styling patterns:
- **No MkStickyContainer wrapper** - use just `<MkSpacer>` directly
- **Title/Description**: `<div class="title">` + `<div class="description">` at top
- **Card-based layout**: Use `.settings-card` with `.card-header` and `.card-content`
- **Icons**: Use Phosphor icons consistently (e.g., `ph-gear-bold ph-lg`)
- **Responsive**: Include `@media (max-width: 768px)` for mobile

### Registration Checklist
When creating a new school-admin page:
1. Create page in `packages/client/src/pages/school-admin/your-page.vue`
2. Add route to `packages/client/src/router.ts` in school-admin children
3. Add menu item to `packages/client/src/pages/school-admin/index.vue` `menuDef` computed property
4. Use consistent styling patterns from other pages (billing.vue, profile.vue)

### Styling Reference
```scss
.title {
  font-weight: bold;
  font-size: 1.2em;
  margin-bottom: 0.5em;
}

.description {
  opacity: 0.7;
  margin-bottom: 2em;
}

.settings-card {
  background: var(--panel);
  border-radius: 12px;
  border: 1px solid var(--divider);
  overflow: hidden;
}
```

## Graduation & Alumni System

The platform automatically processes student graduations with grace periods:
- **Graduation trigger**: When a student's `graduationDate` is reached
- **Grace period**: 30 days after graduation before account deletion
- **Scheduled processing**:
  - Daily at midnight: Process graduations (`processGraduations`)
  - Daily at 1 AM: Process grace period expirations (`processGraduatedDeletions`)
- **Data**: Stored in `graduated_students` table with `gracePeriodEndsAt` timestamp
- **Student status**: Changed to `isAlumni: true`, `enrollmentStatus: 'graduated'`
- **Account deletion**: Queued via `createDeleteAccountJob()` after grace period
- **Notifications**: Warning sent 7 days before grace period ends (optional feature)

See: `src/services/school-service.ts:processGraduations()` and `src/queue/processors/system/process-graduations.ts`
