# databases-wad

Agent skill for reading and triggering NetApp Workload Factory registered (continuous) drift assessments for managed MSSQL and Oracle database instances.

## Layout

```
databases-wad/
├── SKILL.md                    Lean entry point: routing rules, common auth/headers, workflow steps.
├── references/
│   ├── mssql.md                Full MSSQL detail: endpoints, dimensions, response shapes, curl examples.
│   └── oracle.md               Full Oracle detail: endpoints, dimensions, response shapes, curl examples.
└── README.md                   This file.
```

## How an agent uses this

1. The frontmatter description in `SKILL.md` lists trigger phrases (drift assessment, registered assessment, "what does Workload Factory say", patch scan, dismiss findings, etc.). When any of those fire, the agent loads `SKILL.md`.
2. `SKILL.md` routes to the correct engine by keyword, identifier hint, or by asking the user.
3. The agent reads the engine-specific reference file (`references/mssql.md` or `references/oracle.md`) for endpoint paths, dimension names, and response shapes.
4. For mutating calls (trigger / dismiss), the agent confirms with the user before sending.

## Out of scope

This skill deliberately limits itself to registered (continuous) drift assessment. It refuses (politely, with an alternative) requests for:

- Offline / one-time WAD upload flow (`/offline-assessment/...`)
- Apply / remediate / "fix now" / optimize flows (`*-optimize`, `optimize/storage-configuration`, `optimize/storage-layout`, `database-hosts/optimize`)

## Authoritative source

NetApp Workload Factory wlmdb service:
- Staging: `https://staging.api.workloads.netapp.com/accounts/{accountId}/wlmdb/v1`
- Production: `https://api.workloads.netapp.com/accounts/{accountId}/wlmdb/v1`
