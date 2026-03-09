const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER, 10);
const ISSUE_CREATOR = process.env.ISSUE_CREATOR;
const ISSUE_LABELS = JSON.parse(process.env.ISSUE_LABELS || "[]");

const PROJECT_ORG = "TLVeng";
const PROJECT_NUMBER = 41;

const STATUS_DEFAULT = "Todo";

// Map issue labels to the project "Type" field value.
// First matching label wins.
const LABEL_TO_TYPE = {
  "Test Item": "Test Item",
  "Test Plan": "Test Plan",
  Task: "Task",
  Story: "Story",
  Epic: "Epic",
  Bug: "Bug",
};

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const graphqlWithAuth = graphql.defaults({
  headers: { authorization: `token ${GITHUB_TOKEN}` },
});

// ── Resolve Type from labels ────────────────────────────────────────────────

function resolveType() {
  for (const label of ISSUE_LABELS) {
    if (LABEL_TO_TYPE[label]) {
      return LABEL_TO_TYPE[label];
    }
  }
  return null;
}

// ── 1. Set Assignee to Issue Creator ────────────────────────────────────────

async function setAssignee() {
  console.log(`Setting assignee to issue creator: ${ISSUE_CREATOR}`);
  // Remove any existing assignees first
  const { data: issue } = await octokit.issues.get({
    owner,
    repo,
    issue_number: ISSUE_NUMBER,
  });
  const existingAssignees = issue.assignees.map((a) => a.login);
  if (existingAssignees.length > 0) {
    await octokit.issues.removeAssignees({
      owner,
      repo,
      issue_number: ISSUE_NUMBER,
      assignees: existingAssignees,
    });
  }
  // Add the creator as assignee
  await octokit.issues.addAssignees({
    owner,
    repo,
    issue_number: ISSUE_NUMBER,
    assignees: [ISSUE_CREATOR],
  });
  console.log(`Assignee set to ${ISSUE_CREATOR}`);
}

// ── 2. Set Milestone to Current Open Milestone ─────────────────────────────

async function setMilestone() {
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

async function getProjectAndAddIssue() {
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
      contentId: ISSUE_NODE_ID,
    }
  );

  const itemId = addResult.addProjectV2ItemById.item.id;
  console.log(`Issue is in project as item: ${itemId}`);

  return { project, itemId };
}

// ── 4. Set a Single-Select Field ────────────────────────────────────────────

async function setSingleSelectField(project, itemId, fieldName, optionName) {
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

async function setCurrentSprint(project, itemId) {
  const iterationField = project.fields.nodes.find(
    (f) => f.configuration && f.configuration.iterations
  );
  if (!iterationField) {
    console.warn("No iteration/sprint field found in project — skipping.");
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

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log(`Processing issue #${ISSUE_NUMBER} with labels: ${ISSUE_LABELS.join(", ")}`);

    // Step 1: Set assignee to issue creator
    await setAssignee();

    // Step 2: Set milestone
    await setMilestone();

    // Step 3: Get project, add issue, fetch fields
    const { project, itemId } = await getProjectAndAddIssue();

    // Step 4: Set Status to "Todo"
    await setSingleSelectField(project, itemId, "Status", STATUS_DEFAULT);

    // Step 5: Set Type based on label
    const issueType = resolveType();
    if (issueType) {
      await setSingleSelectField(project, itemId, "Type", issueType);
    } else {
      console.warn(
        `No matching Type found for labels: ${ISSUE_LABELS.join(", ")} — skipping Type.`
      );
    }

    // Step 6: Set Sprint to current iteration
    await setCurrentSprint(project, itemId);

    console.log("All defaults set successfully.");
  } catch (error) {
    console.error("Failed to set issue defaults:", error.message);
    process.exit(1);
  }
})();
