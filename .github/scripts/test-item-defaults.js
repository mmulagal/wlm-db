const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER, 10);
const ISSUE_CREATOR = process.env.ISSUE_CREATOR;

const PROJECT_ORG = "TLVeng";
const PROJECT_NUMBER = 41;

const STATUS_DEFAULT = "To Do";

// Default codeowner auto-assigned by repo settings. We replace this with the
// actual issue creator, but we never overwrite a real human assignee.
const DEFAULT_CODEOWNER = "shaswatinetapp";

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const graphqlWithAuth = graphql.defaults({
  headers: { authorization: `token ${GITHUB_TOKEN}` },
});

// ── 0. Fetch Issue Data (single API call, reused across steps) ───────────────

async function fetchIssue() {
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: ISSUE_NUMBER,
  });
  return issue;
}

// ── 1. Set Assignee to Issue Creator ────────────────────────────────────────
// Only act when the issue has no assignees, or when the sole assignee is the
// default codeowner (`shaswatinetapp`). Any other state — creator already
// assigned, a different human assigned, or multiple assignees — is left alone
// so we do not overwrite manual choices or produce spurious unassign/assign
// events.

async function setAssignee(issue) {
  const existing = issue.assignees.map((a) => a.login);
  const shouldAct =
    existing.length === 0 ||
    (existing.length === 1 && existing[0] === DEFAULT_CODEOWNER);

  if (!shouldAct) {
    console.log(
      `Assignee already set to [${existing.join(", ")}] — leaving alone.`
    );
    return;
  }

  if (existing.includes(DEFAULT_CODEOWNER)) {
    await octokit.issues.removeAssignees({
      owner,
      repo,
      issue_number: ISSUE_NUMBER,
      assignees: [DEFAULT_CODEOWNER],
    });
  }

  if (existing.includes(ISSUE_CREATOR)) {
    console.log(`Creator ${ISSUE_CREATOR} already assigned — nothing to add.`);
    return;
  }

  console.log(`Setting assignee to issue creator: ${ISSUE_CREATOR}`);
  await octokit.issues.addAssignees({
    owner,
    repo,
    issue_number: ISSUE_NUMBER,
    assignees: [ISSUE_CREATOR],
  });
  console.log(`Assignee set to ${ISSUE_CREATOR}`);
}

// ── 2. Set Milestone to Current Open Milestone ─────────────────────────────

async function setMilestone(issue) {
  if (issue.milestone) {
    console.log(
      `Milestone already set to "${issue.milestone.title}" — leaving alone.`
    );
    return;
  }

  console.log("Fetching open milestones...");
  const { data: milestones } = await octokit.issues.listMilestones({
    owner,
    repo,
    state: "open",
    sort: "due_on",
    direction: "asc",
  });

  if (milestones.length === 0) {
    console.warn("No open milestones found — skipping milestone assignment.");
    return;
  }

  // Pick the milestone with the nearest future due date, or the first one
  const now = new Date();
  let chosen = milestones.find((m) => m.due_on && new Date(m.due_on) >= now);
  if (!chosen) {
    // No future-dated milestone; pick the most recently created open one
    chosen = milestones[milestones.length - 1];
  }

  console.log(`Setting milestone to: "${chosen.title}" (#${chosen.number})`);
  await octokit.issues.update({
    owner,
    repo,
    issue_number: ISSUE_NUMBER,
    milestone: chosen.number,
  });
  console.log(`Milestone set to "${chosen.title}"`);
}

// ── 3. Get Project Info and Ensure Issue is in Project ──────────────────────

async function getProjectAndAddIssue(issueNodeId) {
  console.log(
    `Fetching project ${PROJECT_ORG}/${PROJECT_NUMBER} and its fields...`
  );

  const query = `
    query($org: String!, $number: Int!) {
      organization(login: $org) {
        projectV2(number: $number) {
          id
          fields(first: 50) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
              ... on ProjectV2IterationField {
                id
                name
                configuration {
                  iterations {
                    id
                    title
                    startDate
                    duration
                  }
                  completedIterations {
                    id
                    title
                    startDate
                    duration
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await graphqlWithAuth(query, {
    org: PROJECT_ORG,
    number: PROJECT_NUMBER,
  });

  const project = result.organization.projectV2;
  console.log(`Found project: ${project.id}`);

  // Add issue to project (idempotent — if already there, returns existing item)
  console.log("Adding issue to project...");
  const addResult = await graphqlWithAuth(
    `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `,
    {
      projectId: project.id,
      contentId: issueNodeId,
    }
  );

  const itemId = addResult.addProjectV2ItemById.item.id;
  console.log(`Issue is in project as item: ${itemId}`);

  const currentFieldValues = await fetchItemFieldValues(itemId);
  return { project, itemId, currentFieldValues };
}

// Returns a map of { [fieldName]: displayValue } for single-select and
// iteration fields already populated on this project item. Newly-added items
// return an empty object, so downstream skip-logic only fires when a value
// was previously set (manually or by a prior run).

async function fetchItemFieldValues(itemId) {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          fieldValues(first: 50) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                field { ... on ProjectV2IterationField { name } }
              }
            }
          }
        }
      }
    }
  `;

  const result = await graphqlWithAuth(query, { itemId });
  const nodes = (result.node && result.node.fieldValues && result.node.fieldValues.nodes) || [];

  const values = {};
  for (const node of nodes) {
    if (!node || !node.field || !node.field.name) continue;
    if (node.__typename === "ProjectV2ItemFieldSingleSelectValue" && node.name) {
      values[node.field.name] = node.name;
    } else if (node.__typename === "ProjectV2ItemFieldIterationValue" && node.title) {
      values[node.field.name] = node.title;
    }
  }
  return values;
}

// ── 4. Set a Single-Select Field ────────────────────────────────────────────

async function setSingleSelectField(
  project,
  itemId,
  fieldName,
  optionName,
  currentFieldValues = {}
) {
  if (currentFieldValues[fieldName]) {
    console.log(
      `${fieldName} already set to "${currentFieldValues[fieldName]}" — leaving alone.`
    );
    return;
  }

  const field = project.fields.nodes.find(
    (f) => f.name === fieldName && f.options
  );
  if (!field) {
    console.warn(`Field "${fieldName}" not found in project — skipping.`);
    return;
  }

  const option = field.options.find((o) => o.name === optionName);
  if (!option) {
    console.warn(
      `Option "${optionName}" not found in field "${fieldName}" — available options: ${field.options.map((o) => o.name).join(", ")}. Skipping.`
    );
    return;
  }

  console.log(`Setting ${fieldName} to "${optionName}"...`);
  await graphqlWithAuth(
    `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  `,
    {
      projectId: project.id,
      itemId,
      fieldId: field.id,
      optionId: option.id,
    }
  );
  console.log(`${fieldName} set to "${optionName}"`);
}

// ── 5. Set Sprint to Current Iteration ──────────────────────────────────────

async function setCurrentSprint(project, itemId, currentFieldValues = {}) {
  const iterationField = project.fields.nodes.find(
    (f) => f.configuration && f.configuration.iterations
  );
  if (!iterationField) {
    console.warn("No iteration/sprint field found in project — skipping.");
    return;
  }

  if (currentFieldValues[iterationField.name]) {
    console.log(
      `${iterationField.name} already set to "${currentFieldValues[iterationField.name]}" — leaving alone.`
    );
    return;
  }

  const allIterations = [
    ...iterationField.configuration.iterations,
    ...iterationField.configuration.completedIterations,
  ];

  // Find the iteration whose date range contains today
  const now = new Date();
  const currentIteration = allIterations.find((iter) => {
    const start = new Date(iter.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + iter.duration);
    return now >= start && now <= end;
  });

  if (!currentIteration) {
    // Fallback: pick the nearest future iteration
    const futureIterations = iterationField.configuration.iterations
      .filter((iter) => new Date(iter.startDate) >= now)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    if (futureIterations.length > 0) {
      console.log(
        `No active sprint today — using next upcoming sprint: "${futureIterations[0].title}"`
      );
      await setIterationValue(
        project,
        itemId,
        iterationField,
        futureIterations[0]
      );
      return;
    }

    console.warn("No current or future sprint found — skipping.");
    return;
  }

  console.log(
    `Setting sprint to current iteration: "${currentIteration.title}"`
  );
  await setIterationValue(project, itemId, iterationField, currentIteration);
}

async function setIterationValue(project, itemId, field, iteration) {
  await graphqlWithAuth(
    `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: { iterationId: $iterationId }
      }) {
        projectV2Item { id }
      }
    }
  `,
    {
      projectId: project.id,
      itemId,
      fieldId: field.id,
      iterationId: iteration.id,
    }
  );
  console.log(`Sprint set to "${iteration.title}"`);
}

// ── 6. Link Parent Issue (sub-issue relationship) ───────────────────────────

function parseParentIssueNumber(body) {
  // Look for the "### Parent Issue" section in the issue body.
  // GitHub Issue Forms render input fields as: ### Label\n\n<value>
  if (!body) return null;

  const match = body.match(
    /###\s*Parent\s*Issue\s*\n\n\s*(.+)/i
  );
  if (!match) return null;

  const value = match[1].trim();
  if (!value || value === "_No response_") return null;

  // Support formats: #1234, 1234, or full GitHub URL
  const hashMatch = value.match(/^#?(\d+)$/);
  if (hashMatch) return parseInt(hashMatch[1], 10);

  const urlMatch = value.match(
    /github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/
  );
  if (urlMatch) return parseInt(urlMatch[1], 10);

  console.warn(
    `Could not parse parent issue number from: "${value}" — skipping.`
  );
  return null;
}

async function linkParentIssue(issue) {
  const parentNumber = parseParentIssueNumber(issue.body);
  if (!parentNumber) {
    console.log("No parent issue specified — skipping sub-issue linking.");
    return;
  }

  console.log(
    `Linking issue #${ISSUE_NUMBER} as sub-issue of #${parentNumber}...`
  );
  try {
    await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues",
      {
        owner,
        repo,
        issue_number: parentNumber,
        sub_issue_id: issue.id,
      }
    );
    console.log(`Issue #${ISSUE_NUMBER} linked as sub-issue of #${parentNumber}`);
  } catch (error) {
    console.warn(
      `Could not link parent issue #${parentNumber}: ${error.message}`
    );
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
// Note: Issue type is set natively by each issue template via the `type` field
// in .github/ISSUE_TEMPLATE/*.yml — no need to set it here.

(async () => {
  try {
    console.log(`Processing issue #${ISSUE_NUMBER}...`);

    // Fetch issue data once (reused by multiple steps)
    const issue = await fetchIssue();

    // Step 1: Set assignee to issue creator
    await setAssignee(issue);

    // Step 2: Set milestone
    await setMilestone(issue);

    // Step 3: Get project, add issue, fetch fields and current values
    const { project, itemId, currentFieldValues } = await getProjectAndAddIssue(
      issue.node_id
    );

    // Step 4: Set Status to "To Do"
    await setSingleSelectField(
      project,
      itemId,
      "Status",
      STATUS_DEFAULT,
      currentFieldValues
    );

    // Step 5: Set Sprint to current iteration
    await setCurrentSprint(project, itemId, currentFieldValues);

    // Step 6: Link parent issue if specified in the issue body
    await linkParentIssue(issue);

    console.log("All defaults set successfully.");
  } catch (error) {
    console.error("Failed to set issue defaults:", error.message);
    process.exit(1);
  }
})();
