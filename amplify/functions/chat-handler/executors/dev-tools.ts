import axios from 'axios';
import { ToolExecutionContext } from './types';


const TIMEOUT_MS = 15000; 
const MAX_PAYLOAD_SIZE = 10485760;

const extractApiError = (err: any, platform: string): string => {
    if (err.response?.data?.message) {
        const subErrors = err.response.data.errors 
            ? `: ${err.response.data.errors.map((e: any) => e.message || JSON.stringify(e)).join(', ')}` 
            : '';
        return `${platform} Error: ${err.response.data.message}${subErrors}`;
    }
    return `${platform} Error: ${err.message}`;
};

const truncateContentIfNeeded = (content: string, maxChars = 20000): { content: string; truncated: boolean } => {
    if (content.length > maxChars) {
        return {
            content: content.substring(0, maxChars) + `\n\n... [TRUNCATED: File exceeds ${maxChars} characters] ...`,
            truncated: true
        };
    }
    return { content, truncated: false };
};


export const executeGitHub = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const GITHUB_TOKEN = ephemeralSecrets.githubToken;
    if (!GITHUB_TOKEN) {
        return { error: "Missing GitHub Personal Access Token. Call 'request_secure_credentials' with serviceName 'github'." };
    }

    try {
        const reqConfig = { 
            headers: { 
                Authorization: `Bearer ${GITHUB_TOKEN}`, 
                Accept: 'application/vnd.github.v3+json',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            timeout: TIMEOUT_MS,
            maxContentLength: MAX_PAYLOAD_SIZE,
            maxBodyLength: MAX_PAYLOAD_SIZE
        };
        
        const { 
            action, owner, repo, path, branch, sourceBranch, targetBranch, 
            commitMessage, fileContent, pullRequestTitle, pullRequestBody, 
            pullRequestNumber, query, issueTitle, issueBody 
        } = toolInput;
        
        const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

        if (action === 'GET_REPO') {
            const res = await axios.get(baseUrl, reqConfig);
            const { name, full_name, description, default_branch, stargazers_count, open_issues_count, html_url } = res.data;
            return { status: "Success", repository: { name, full_name, description, default_branch, stargazers_count, open_issues_count, html_url } };
        }
        else if (action === 'GET_TREE') {
            const targetRef = branch || 'HEAD';
            const res = await axios.get(`${baseUrl}/git/trees/${targetRef}?recursive=1`, reqConfig);
            const tree = res.data.tree?.slice(0, 300).map((item: any) => ({ path: item.path, type: item.type, size: item.size }));
            return { status: "Success", truncated: res.data.tree?.length > 300, tree };
        }
        else if (action === 'SEARCH_CODE' && query) {
            const res = await axios.get(`https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:${owner}/${repo}`, reqConfig);
            const items = res.data.items?.slice(0, 10).map((i: any) => ({ name: i.name, path: i.path, html_url: i.html_url }));
            return { status: "Success", totalCount: res.data.total_count, items };
        }
        else if (action === 'GET_FILE' && path) {
            const url = branch ? `${baseUrl}/contents/${path}?ref=${branch}` : `${baseUrl}/contents/${path}`;
            const res = await axios.get(url, reqConfig);
            
            if (Array.isArray(res.data)) {
                return { status: "Success", isDirectory: true, items: res.data.map((i: any) => ({ name: i.name, path: i.path, type: i.type })) };
            }

            const rawDecoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
            const { content, truncated } = truncateContentIfNeeded(rawDecoded);
            
            return { 
                status: "Success", 
                fileInfo: { sha: res.data.sha, size: res.data.size, name: res.data.name, truncated }, 
                content 
            };
        }
        else if (action === 'CREATE_BRANCH' && branch && sourceBranch) {
            const refRes = await axios.get(`${baseUrl}/git/ref/heads/${sourceBranch}`, reqConfig);
            const sha = refRes.data.object.sha;

            const res = await axios.post(`${baseUrl}/git/refs`, { ref: `refs/heads/${branch}`, sha }, reqConfig);
            return { status: "Success", ref: res.data.ref, sha: res.data.object.sha };
        }
        else if (action === 'CREATE_OR_UPDATE_FILE' && path && commitMessage && fileContent !== undefined) {
            let sha: string | undefined;
            try {
                const getRes = await axios.get(`${baseUrl}/contents/${path}${branch ? `?ref=${branch}` : ''}`, reqConfig);
                sha = getRes.data.sha;
            } catch (e: any) { 
                if (e.response?.status !== 404) throw e; 
            }

            const payload: any = {
                message: commitMessage,
                content: Buffer.from(fileContent, 'utf-8').toString('base64')
            };
            if (sha) payload.sha = sha;
            if (branch) payload.branch = branch;

            const res = await axios.put(`${baseUrl}/contents/${path}`, payload, reqConfig);
            return { status: "Success", commitSha: res.data.commit.sha, htmlUrl: res.data.content?.html_url };
        }
        else if (action === 'CREATE_PULL_REQUEST' && sourceBranch && targetBranch) {
            const payload = { title: pullRequestTitle || "Automated PR", body: pullRequestBody || "", head: sourceBranch, base: targetBranch };
            const res = await axios.post(`${baseUrl}/pulls`, payload, reqConfig);
            return { status: "Success", pullRequestNumber: res.data.number, pullRequestUrl: res.data.html_url };
        }
        else if (action === 'GET_PR_FILES' && pullRequestNumber) {
            const res = await axios.get(`${baseUrl}/pulls/${pullRequestNumber}/files`, reqConfig);
            const files = res.data.map((f: any) => ({
                filename: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                patch: f.patch ? truncateContentIfNeeded(f.patch, 4000).content : 'No patch available'
            }));
            return { status: "Success", pullRequestNumber, filesChanged: files.length, files };
        }
        else if (action === 'MERGE_PULL_REQUEST' && pullRequestNumber) {
            const payload: any = {};
            if (commitMessage) payload.commit_message = commitMessage;
            const res = await axios.put(`${baseUrl}/pulls/${pullRequestNumber}/merge`, payload, reqConfig);
            return { status: "Success", merged: res.data.merged, sha: res.data.sha };
        }
        else if (action === 'CREATE_ISSUE' && issueTitle) {
            const payload = { title: issueTitle, body: issueBody || "" };
            const res = await axios.post(`${baseUrl}/issues`, payload, reqConfig);
            return { status: "Success", issueNumber: res.data.number, issueUrl: res.data.html_url };
        }

        return { error: `Missing required parameters or unsupported GitHub action: ${action}` };
    } catch (err: any) {
        return { error: extractApiError(err, 'GitHub') };
    }
};


export const executeGitLab = async ({ toolInput, ephemeralSecrets }: ToolExecutionContext) => {
    const GITLAB_TOKEN = ephemeralSecrets.gitlabToken;
    const GITLAB_DOMAIN = ephemeralSecrets.gitlabDomain || 'gitlab.com';

    if (!GITLAB_TOKEN) {
        return { error: "Missing GitLab Access Token. Call 'request_secure_credentials' with serviceName 'gitlab'." };
    }

    try {
        const reqConfig = { 
            headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN, Accept: 'application/json' },
            timeout: TIMEOUT_MS,
            maxContentLength: MAX_PAYLOAD_SIZE,
            maxBodyLength: MAX_PAYLOAD_SIZE
        };

        const { 
            action, projectId, filePath, branch, sourceBranch, targetBranch, 
            commitMessage, fileContent, fileAction, mergeRequestTitle, 
            mergeRequestBody, mergeRequestIid, issueTitle, issueDescription 
        } = toolInput;

        const encodedProjectId = encodeURIComponent(projectId);
        const baseUrl = `https://${GITLAB_DOMAIN}/api/v4/projects/${encodedProjectId}`;

        if (action === 'GET_PROJECT') {
            const res = await axios.get(baseUrl, reqConfig);
            const { id, name, path_with_namespace, description, default_branch, web_url } = res.data;
            return { status: "Success", project: { id, name, path_with_namespace, description, default_branch, web_url } };
        }
        else if (action === 'GET_TREE') {
            const ref = branch ? `?ref=${encodeURIComponent(branch)}&recursive=true` : '?recursive=true';
            const res = await axios.get(`${baseUrl}/repository/tree${ref}`, reqConfig);
            const tree = res.data.slice(0, 300).map((i: any) => ({ id: i.id, name: i.name, type: i.type, path: i.path }));
            return { status: "Success", truncated: res.data.length > 300, tree };
        }
        else if (action === 'GET_FILE' && filePath && branch) {
            const encodedPath = encodeURIComponent(filePath);
            const res = await axios.get(`${baseUrl}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`, reqConfig);
            const rawDecoded = Buffer.from(res.data.content, 'base64').toString('utf-8');
            const { content, truncated } = truncateContentIfNeeded(rawDecoded);

            return { 
                status: "Success", 
                fileInfo: { commit_id: res.data.commit_id, size: res.data.size, file_name: res.data.file_name, truncated }, 
                content 
            };
        }
        else if (action === 'CREATE_BRANCH' && branch && sourceBranch) {
            const res = await axios.post(`${baseUrl}/repository/branches?branch=${encodeURIComponent(branch)}&ref=${encodeURIComponent(sourceBranch)}`, {}, reqConfig);
            return { status: "Success", branch: res.data.name, commitSha: res.data.commit?.id };
        }
        else if (action === 'COMMIT_FILE' && branch && commitMessage && filePath && fileAction) {
            const payload = {
                branch: branch,
                commit_message: commitMessage,
                actions: [{ action: fileAction, file_path: filePath, content: fileContent || "" }]
            };
            const res = await axios.post(`${baseUrl}/repository/commits`, payload, reqConfig);
            return { status: "Success", commitId: res.data.id, webUrl: res.data.web_url };
        }
        else if (action === 'CREATE_MERGE_REQUEST' && sourceBranch && targetBranch) {
            const payload = { source_branch: sourceBranch, target_branch: targetBranch, title: mergeRequestTitle || "Automated MR", description: mergeRequestBody || "" };
            const res = await axios.post(`${baseUrl}/merge_requests`, payload, reqConfig);
            return { status: "Success", mergeRequestIid: res.data.iid, mergeRequestUrl: res.data.web_url };
        }
        else if (action === 'GET_MR_CHANGES' && mergeRequestIid) {
            const res = await axios.get(`${baseUrl}/merge_requests/${mergeRequestIid}/changes`, reqConfig);
            const changes = res.data.changes?.map((c: any) => ({
                old_path: c.old_path,
                new_path: c.new_path,
                new_file: c.new_file,
                renamed_file: c.renamed_file,
                deleted_file: c.deleted_file,
                diff: truncateContentIfNeeded(c.diff, 4000).content
            }));
            return { status: "Success", mergeRequestIid, changesCount: changes?.length, changes };
        }
        else if (action === 'ACCEPT_MERGE_REQUEST' && mergeRequestIid) {
            const payload: any = {};
            if (commitMessage) payload.merge_commit_message = commitMessage;
            const res = await axios.put(`${baseUrl}/merge_requests/${mergeRequestIid}/merge`, payload, reqConfig);
            return { status: "Success", mergeCommitSha: res.data.merge_commit_sha, state: res.data.state };
        }
        else if (action === 'CREATE_ISSUE' && issueTitle) {
            const payload = { title: issueTitle, description: issueDescription || "" };
            const res = await axios.post(`${baseUrl}/issues`, payload, reqConfig);
            return { status: "Success", issueIid: res.data.iid, issueUrl: res.data.web_url };
        }

        return { error: `Missing required parameters or unsupported GitLab action: ${action}` };
    } catch (err: any) {
        return { error: extractApiError(err, 'GitLab') };
    }
};