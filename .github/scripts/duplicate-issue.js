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

(async () => {
    // 1. Get all sub-issues (children) of the parent issue
    // const subIssues = await getChildIssues(owner, repo, ISSUE_NUMBER);
    const { data: subIssues } = await octokit.rest.issues.listSubIssues({
            owner,
            repo,
            issue_number: ISSUE_NUMBER,
        });
    console.log("Found sub-issues:", subIssues.map(i => i.number));

    // 2. Clone each sub-issue
    const clonedSubIssues = {};
    for (const subIssue of subIssues) {
        const result = await cloneIssue(owner, repo, subIssue.number);
        clonedSubIssues[subIssue.number] = result;
        console.log(`Cloned sub-issue #${result.original} to #${result.cloned}`);
    }

    // 3. Clone parent issue
    const parentResult = await cloneIssue(owner, repo, ISSUE_NUMBER);
    console.log(`Cloned parent issue #${parentResult.original} to #${parentResult.cloned}`);

    // 4. Replicate parent/child relationship in GitHub Projects (issue hierarchy)
    for (const subIssue of subIssues) {
        try {
            await octokit.rest.issues.addSubIssue({
                owner,
                repo,
                issue_number: parentResult.cloned,
                sub_issue_id: clonedSubIssues[subIssue.number].cloned,
            });
        } catch (e) {
            console.error(`Failed to attach sub-issue #${clonedSubIssues[subIssue.number].cloned} to parent #${parentResult.cloned}: ${e.message}`);
        }
    }

    console.log("All done.");
})();