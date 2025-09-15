const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER, 10);

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${GITHUB_TOKEN}` }
});

// Utility: Get all child issues of a parent issue
async function getChildIssues(owner, repo, issueNumber) {
    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            id
            number
            title
            body
            trackedIssues(first: 100) {
              nodes {
                id
                number
                title
                body
              }
            }
          }
        }
      }
    `;
    const result = await graphqlWithAuth(query, { owner, repo, issueNumber });
    return result.repository.issue.trackedIssues.nodes;
}

// Utility: Get parent issue (if any)
async function getParentIssue(owner, repo, issueNumber) {
    const query = `
        query($owner: String!, $repo: String!, $issueNumber: Int!) {
            repository(owner: $owner, name: $repo) {
                issue(number: $issueNumber) {
                    id
                    number
                    title
                    body
                    trackedByIssues(first: 1) {
                        nodes {
                            id
                            number
                            title
                        }
                    }
                }
            }
        }
    `;
    const result = await graphqlWithAuth(query, { owner, repo, issueNumber });
    const trackedBy = result.repository.issue.trackedByIssues.nodes;
    return trackedBy.length > 0 ? trackedBy[0] : null;
}

// Utility: Get projects linked to an issue
async function getProjectsLinkedToIssue(owner, repo, issueNumber) {
    const query = `
        query($owner: String!, $repo: String!, $issueNumber: Int!) {
            repository(owner: $owner, name: $repo) {
                issue(number: $issueNumber) {
                    projectItems(first: 100) {
                        nodes {
                            id
                            project {
                                id
                                title
                            }
                            fieldValues(first: 20) {
                                nodes {
                                    ... on ProjectV2ItemFieldIterationValue {
                                        title
                                        id
                                        iterationId
                                        field {
                                            ... on ProjectV2IterationField {
                                                id
                                                name
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;
    const result = await graphqlWithAuth(query, { owner, repo, issueNumber });
    return result.repository.issue.projectItems.nodes.map(item => {
        const iterationFieldNode = item.fieldValues.nodes.find(
            node => node && node.iterationId
        );
        return {
            project_id: item.project.id,
            project_title: item.project.title,
            iteration_id: iterationFieldNode ? iterationFieldNode.iterationId : null,
            field_id: iterationFieldNode && iterationFieldNode.field ? iterationFieldNode.field.id : null
        };
    });
}

// Utility: Set project sprint/iteration for an issue
async function setProjectItemSprint({ projectId, itemId, fieldId, iterationId }) {
    const setSprintMutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String) {
            updateProjectV2ItemFieldValue(input: {
                projectId: $projectId,
                itemId: $itemId,
                fieldId: $fieldId,
                value: { 
                    iterationId: $iterationId
                }
            }) {
                projectV2Item {
                    id
                }
            }
        }
    `;
    await graphqlWithAuth(setSprintMutation, {
        projectId,
        itemId,
        fieldId,
        iterationId
    });
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
    return {
        original: issueNumber,
        cloned: newIssue.number,
        node_id: newIssue.node_id,
    };
}

// Inherit project/sprint from original issue
async function inheritProjectSprintFromOriginalIssue(owner, repo, parentIssueNumber, potentialSubIssue) {
    const projects = await getProjectsLinkedToIssue(owner, repo, parentIssueNumber);
    for (const project of projects) {
        const addResult = await graphqlWithAuth(`
            mutation($projectId: ID!, $contentId: ID!) {
                addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
                    item {
                        id
                    }
                }
            }
        `, {
            projectId: project.project_id,
            contentId: potentialSubIssue.node_id
        });
        const projectV2ItemId = addResult.addProjectV2ItemById.item.id;
        if (project.field_id && project.iteration_id) {
            await setProjectItemSprint({
                projectId: project.project_id,
                itemId: projectV2ItemId,
                fieldId: project.field_id,
                iterationId: project.iteration_id
            });
        }
    }
}

(async () => {
    // 1. Get all sub-issues (children) of the parent issue
    const { data: subIssues } = await octokit.rest.issues.listSubIssues({
        owner,
        repo,
        issue_number: ISSUE_NUMBER, 
    });
    console.log("Found sub-issues:", subIssues.map(i => i.number));

    // 2. Clone each sub-issue (after parent is cloned)
    const clonedSubIssues = {};
    for (const subIssue of subIssues) {
        const result = await cloneIssue(owner, repo, subIssue.number);
        clonedSubIssues[subIssue.number] = result;
        console.log(`Cloned sub-issue #${result.original} to #${result.cloned}`);
    }

    // 3. Clone parent issue
    const parentResult = await cloneIssue(owner, repo, ISSUE_NUMBER);
    console.log(`Cloned parent issue #${parentResult.original} to #${parentResult.cloned}`);

    // 4. Find parent of the original issue (if any) and link
    const parentIssue = await getParentIssue(owner, repo, ISSUE_NUMBER);
    if (parentIssue) {
        await octokit.rest.issues.addSubIssue({
            owner,
            repo,
            issue_number: parentIssue.number,
            sub_issue_id: parentResult.node_id, // Use node_id for linking
        });
        console.log(`Linked cloned parent issue #${parentResult.cloned} to parent #${parentIssue.number}`);
    }

    // 5. Link cloned sub-issues to cloned parent issue (using node_id)
    for (const subIssue of subIssues) {
        try {
            await octokit.rest.issues.addSubIssue({
                owner,
                repo,
                issue_number: parentResult.cloned,
                sub_issue_id: clonedSubIssues[subIssue.number].node_id, // Use node_id
            });
            console.log(`Linked cloned sub-issue #${clonedSubIssues[subIssue.number].cloned} to parent #${parentResult.cloned}`);
        } catch (e) {
            console.error(`Failed to attach sub-issue #${clonedSubIssues[subIssue.number].cloned} to parent #${parentResult.cloned}: ${e.message}`);
        }
    }

    // 6. Inherit project/sprint from original issues
    await inheritProjectSprintFromOriginalIssue(owner, repo, ISSUE_NUMBER, parentResult);
    for (const subIssue of subIssues) {
        await inheritProjectSprintFromOriginalIssue(owner, repo, subIssue.number, clonedSubIssues[subIssue.number]);
    }

    console.log("All done.");
})();