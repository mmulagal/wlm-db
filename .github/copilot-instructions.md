# GitHub Copilot Instructions

** CRITICAL: READ AGENTS.md FIRST**

Before working on any code changes in this repository, you **MUST** read and follow all instructions in the [`AGENTS.md`](../AGENTS.md) file located at the root of this repository.

**Package-Specific Rules:** Also respect package-specific rules in `.github/instructions/*`:
- **UI**: Follow `.github/instructions/copilot-ui.instructions.md` for React/Redux patterns
- **Server**: Follow `.github/instructions/copilot-server.instructions.md` for Node.js/TypeScript patterns  
- **Logs Analyzer**: Follow `.github/instructions/copilot-logs-analyzer.instructions.md` for CLI patterns

**Custom Agents:** Specialized agents are available in `.github/agents/`:
- **Oracle SSM Debug**: Use `.github/agents/oracle-ssm-debug.agent.md` to debug Oracle SSM script issues on EC2 instances

## Complete Instructions

For all workflows, patterns, validation requirements, and development standards, refer to [`AGENTS.md`](../AGENTS.md) - the authoritative source for this repository.

# MANDATORY INSTRUCTION CHECK

**BEFORE ANY CODE MODIFICATION, YOU MUST:**
1. Identify the component you're working on (ui/, server/, logs-analyzer/)
2. Read the corresponding instruction file in `.github/instructions/`
3. Apply ALL patterns, guidelines, and standards specified
4. Follow the coding conventions and best practices

**This is NON-NEGOTIABLE. All code must follow repository instructions.**
