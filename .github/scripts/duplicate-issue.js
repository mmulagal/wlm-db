const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER, 10);

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${GITHUB_TOKEN}` }
});

// Utility: Find sub-issue numbers in checklist
function extractSubIssueNumbers(issueBody) {
    const regex = /- \[[ xX]\] #(\d+)/g;
    const subIssueNumbers = [];
    let match;
    while ((match = regex.exec(issueBody || "")) !== null) {
        subIssueNumbers.push(parseInt(match[1], 10));
    }
    return subIssueNumbers;
}

// Utility: Get projects + sprint/iteration fields for an issue
async function getProjectsLinkedToIssue(owner, repo, issueNumber) {
    try {
        const { repository } = await graphqlWithAuth(`
            query($owner: String!, $repo: String!, $issueNumber: Int!) {
                repository(owner: $owner, name: $repo) {
                    issue(number: $issueNumber) {
                        id
                        projectItems(first: 100) {
                            nodes {
                                id
                                project { id title }
                                fieldValues(first: 20) {
                                    nodes {
                                        ... on ProjectV2ItemFieldIterationValue {
                                            title
                                            id
                                            iterationId
                                            field {
                                                ... on ProjectV2IterationField { id name }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `, { owner, repo, issueNumber });
        return repository.issue.projectItems.nodes.map(item => {
            const iterationNode = item.fieldValues.nodes.find(n => n && n.iterationId);
            return {
                project_id: item.project.id,
                project_title: item.project.title,
                iteration_id: iterationNode ? iterationNode.iterationId : null,
                field_id: iterationNode && iterationNode.field ? iterationNode.field.id : null
            };
        });
    } catch (error) {
        console.error(`Failed to get projects linked to issue: ${error.message}`);
        return [];
    }
}

// Utility: Add issue to project and set sprint/iteration
async function setProjectItemSprint({ projectId, itemId, fieldId, iterationId }) {
    const setSprintMutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String) {
        updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: { iterationId: $iterationId }
        }) {
            projectV2Item { id }
        }
    }`;
    try {
        await graphqlWithAuth(setSprintMutation, { projectId, itemId, fieldId, iterationId });
    } catch (error) {
        console.error('Failed to set Sprint field:', error);
    }
}

// Utility: Add an issue to a project (returns itemId)
async function addIssueToProject(projectId, contentId) {
    const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
            item { id }
        }
    }`;
    const result = await graphqlWithAuth(mutation, { projectId, contentId });
    return result.addProjectV2ItemById.item.id;
}

// Clone a single issue (returns new issue and node_id)
async function cloneIssue(owner, repo, issueNumber) {
    const { data: originalIssue } = await octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
    });
    const { data: newIssue } = await octokit.issues.create({
        owner,
        repo,
        title: originalIssue.title,
        body: originalIssue.body,
        labels: originalIssue.labels.map(l => l.name),
        assignees: originalIssue.assignees.map(a => a.login),
    });

    // Copy project/sprint/iteration
    const projects = await getProjectsLinkedToIssue(owner, repo, issueNumber);
    for (const project of projects) {
        const itemId = await addIssueToProject(project.project_id, newIssue.node_id);
        if (project.iteration_id && project.field_id) {
            await setProjectItemSprint({
                projectId: project.project_id,
                itemId,
                fieldId: project.field_id,
                iterationId: project.iteration_id,
            });
        }
    }

    return {
        original: issueNumber,
        cloned: newIssue.number,
        node_id: newIssue.node_id,
    };
}

(async () => {
    // 1. Get parent issue and extract sub-issue numbers
    const { data: parentIssue } = await octokit.issues.get({
        owner,
        repo,
        issue_number: ISSUE_NUMBER,
    });
    const subIssueNumbers = extractSubIssueNumbers(parentIssue.body);

    // 2. Clone sub-issues first, keep mapping
    const clonedSubIssues = {};
    for (const subIssueNumber of subIssueNumbers) {
        const result = await cloneIssue(owner, repo, subIssueNumber);
        clonedSubIssues[subIssueNumber] = result;
        console.log(`Cloned sub-issue #${result.original} to #${result.cloned}`);
    }

    // 3. Clone parent issue
    const parentResult = await cloneIssue(owner, repo, ISSUE_NUMBER);
    console.log(`Cloned parent issue #${parentResult.original} to #${parentResult.cloned}`);

    // 4. Replicate parent/child relationship in GitHub Projects (issue hierarchy)
    // If your repo supports the REST API for issue hierarchy:
    for (const subIssueNumber of subIssueNumbers) {
        // Add cloned sub-issue as child of cloned parent
        await octokit.rest.issues.addSubIssue({
            owner,
            repo,
            issue_number: parentResult.cloned,
            sub_issue_id: clonedSubIssues[subIssueNumber].cloned,
        });
    }

    console.log("All done.");
})();