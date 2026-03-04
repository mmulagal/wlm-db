---
applyTo: "**/logs-analyzer/src/**/*.ts"
---

# Logs Analyzer CLI-Specific Patterns

General TypeScript, logging, error handling, and type safety are in core rules. This covers logs-analyzer-only patterns.

The logs-analyzer is a **standalone CLI** that reads database logs (MSSQL, Oracle, PostgreSQL), uses AWS Bedrock (Claude) for AI-driven analysis, and provides remediation recommendations. Ships as compiled binaries via `@yao-pkg/pkg`.

## CLI Argument Handling

Use `commander` with `.requiredOption()`. Provide sensible defaults for optional params. Destructure into typed constants.

## AWS Bedrock Integration

- Use `@aws-sdk/client-bedrock-runtime` with `ConverseCommand` for structured conversations.
- Define tool specifications for agent capabilities.
- Set appropriate inference config (temperature, topP, maxTokens).

## Database-Specific Log Parsing

- Separate operation files per database type in `src/operations/`.
- Export consistent interfaces across types. Return unified `ErrorLog` structure.

## Script Execution (AI-Generated)

### PowerShell (MSSQL)

Template literals with `ConvertTo-Json -Compress` output. Handle SQL auth modes.

### Bash/Linux (Oracle, PostgreSQL)

Heredocs with `json.dumps()` output. Run as appropriate user.

## Concurrency Control

Use `p-limit` (3-5 for file I/O) to control concurrent operations.

## Constants & Prompts

- All constants in `src/utils/const.ts`. AI prompts as named constants.
- Template literals for parameterized prompts.

## Tool Definitions

Define in `src/utils/tools.ts` following AWS Bedrock tool specification format.

## Output & Reporting

- Write to `output/` directory with timestamped filenames.
- Output structured JSON for programmatic consumption.

```typescript
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = `${outputDir}/remediation_recommendations_${timestamp}.json`;
writeFileSync(outputFile, JSON.stringify(results, null, 2));
```

## Build & Packaging

- `esbuild` for bundling, `@yao-pkg/pkg` for standalone binaries.
- Target Windows, macOS, Linux.

## Quick Reference

- [ ] CLI args: `commander` with `.requiredOption()`
- [ ] Bedrock: `ConverseCommand` with tool definitions
- [ ] Concurrency: `p-limit` (3-5 for file I/O)
- [ ] Log parsing: per-DB operations file, unified `ErrorLog` return
- [ ] Prompts: named constants in `src/utils/const.ts`
- [ ] Tools: `src/utils/tools.ts` (Bedrock spec format)
- [ ] Output: `output/` dir with timestamps
