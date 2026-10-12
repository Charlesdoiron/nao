# nao-managed AI credits — V0

Status: implemented
Last reviewed: 2026-10-09

## Decision

nao Cloud gives each eligible user one **$5 managed AI grant** without requiring a provider key. The entitlement is per user, but the balance is stored in the organization where it is claimed because the organization is the billing, access-control, and usage-attribution boundary. Even free managed calls require an active trial.

Each organization has one shared wallet. Member grants accumulate there, any member can consume them, and they stay with the organization when a contributor leaves. A user cannot contribute another grant elsewhere.

This prevents instant onboarding: the first managed send must confirm which project's organization will permanently receive the grant. The extra step prevents a temporary or personal project from silently taking credit intended for the user's company.

V0 excludes checkout, paid top-ups, subscriptions, markup, gateway comparison, and multi-currency behavior.

## Availability and claim

Managed AI is available when nao runs in cloud mode, the managed upstream key is configured, the `nao` provider is enabled, and the project has no BYOK source. Models remain visible while the user can claim a grant or the organization has a positive balance.

Model discovery and credit reads are side-effect free. The first interactive managed send names the current project's organization; confirming calls `ensureWelcomeGrant(orgId, userId)`. The transaction creates the wallet, inserts a $5 `gift`, and increments the balance only when the globally unique `welcome-user:v1:{userId}` key is inserted.

```mermaid
sequenceDiagram
    participant U as User
    participant C as Chat
    participant W as Wallet service
    participant D as Database

    U->>C: Send first managed message
    C-->>U: Confirm project organization
    U->>C: Apply $5 and send
    C->>W: Claim grant
    W->>D: Insert gift with global user key
    alt First claim
        D-->>W: Gift inserted
        W->>D: Add $5 to organization wallet
        W-->>C: Continue send
    else Already claimed
        D-->>W: Idempotency conflict
        W-->>C: Keep existing assignment
    end
```

Non-interactive calls cannot claim implicitly and fail until the user confirms interactively. Once claimed, the user may consume another organization's funded wallet when they are a member. Exhaustion hides managed models and blocks inference without deleting projects, chats, schedules, or data. BYOK projects remain independent.

The upstream credential remains a deployment secret and is never stored in a project or returned to a user.

## Accounting and settlement

The shared AI SDK wrapper meters every nao-managed generated or streamed invocation, including nested calls. BYOK models bypass credit metering and persistence because users can inspect those calls in their provider platform. An agent run has one `run_id`; each managed model invocation has a unique `operation_id`, preserving per-call detail for chat, subagents, compaction, memory, titles, automations, stories, cron parsing, context recommendations, and test agents.

```mermaid
flowchart TB
    request["Model invocation"] --> managed{"nao-managed?"}
    managed -->|Yes| claimed{"Grant claimed?"}
    claimed -->|No| confirm["Require confirmation"]
    claimed -->|Yes| balance{"Wallet positive?"}
    balance -->|No| blocked["Reject call"]
    balance -->|Yes| provider["Call nao provider"]
    managed -->|No, BYOK| byokProvider["Call customer provider without credit metering"]
    provider --> usage["Insert ai_usage"]
    usage --> charge["Charge wallet and append ledger entry"]
```

Each `ai_usage` row records managed-credit attribution, category, provider/model, status and finish reason, provider request ID, detailed input/cache/output/reasoning token usage, snapshotted rates, calculated upstream cost and customer charge, cost source, and start/completion timestamps. Completed calls use provider usage; failed or aborted calls estimate missing tokens from prompt and streamed characters. Duration remains derivable from the timestamps.

Usage insertion, wallet charging, and its ledger entry are atomic. The operation ID also makes settlement idempotent. Prompts, model outputs, credentials, and provider error payloads are not copied into the accounting tables. BYOK calls create neither `ai_usage` nor credit-ledger rows.

## Data model

PostgreSQL and SQLite use the same accounting model:

```mermaid
erDiagram
    ORGANIZATION ||--o| CREDIT_WALLET : owns
    CREDIT_WALLET ||--o{ CREDIT_LEDGER : records
    CREDIT_WALLET ||--o{ AI_USAGE : funds
    USER ||--o{ AI_USAGE : initiates
    ORGANIZATION ||--o{ AI_USAGE : billed_for
    PROJECT ||--o{ AI_USAGE : attributes
    CHAT ||--o{ AI_USAGE : groups
    AI_USAGE ||--o| CREDIT_LEDGER : creates
```

- `credit_wallet`: one organization balance stored in micro-USD.
- `credit_ledger`: append-only `gift` and `usage` movements with unique idempotency keys.
- `ai_usage`: one row per nao-managed invocation or billable attempt, grouped by `run_id`.

Foreign keys use `ON DELETE SET NULL` so accounting history survives the removal of attributed entities.

## UI and authorization

The cloud-only **Credits & wallet** page shows the selected organization's balance, grant and spend totals, grouped ledger history, and per-call nao credit usage. Admins see all organization managed usage; other members see only their calls while still seeing the shared wallet.

Chat credit status follows the current project's organization. An eligible user can select managed models before claiming, but the first send pauses for confirmation. Completing a managed chat refreshes balance, ledger, usage, and model queries.

## Known V0 limits

- **No reservation before inference.** A large or concurrent call can make the wallet negative.
- **Metering fails open after provider access.** Persistence failure does not replace a completed response.
- **No started row.** A process crash during inference can lose the usage and charge.
- **Estimated partial usage.** Failed and aborted calls may lack exact provider usage.
- **Price-book accounting only.** Provider invoices are not reconciled.
- **Shared-pool consumption.** Members and automations can consume others' grants.
- **No anti-farming controls.** The per-user key does not prevent multiple accounts.
- **One upstream credential.** Managed organizations share its operational limits.

These are promotional-credit constraints, not paid-balance guarantees.
