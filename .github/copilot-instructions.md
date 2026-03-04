# GitHub Copilot Instructions

## Project Overview

See `AGENTS.md` at the repository root for project structure, commands, and development patterns for each package (server, ui, logs-analyzer).

## Coding Rules

Path-specific coding rules auto-load from `.github/instructions/` via `applyTo` metadata. No manual reading required — VS Code Copilot loads the applicable instruction files automatically when you edit matching files.

## Git Conventions

For branch naming, commit messages, PR titles, and pre-push validation, follow `.github/instructions/git-conventions.instructions.md`.

## Custom Agents

Specialized agents are available in `.github/agents/`:
- **Oracle SSM Debug**: Use `.github/agents/oracle-ssm-debug.agent.md` to debug Oracle SSM script issues on EC2 instances
