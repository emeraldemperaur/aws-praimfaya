
export const CORE_SYSTEM_TOOLS = [
    {
        toolSpec: {
            name: "request_secure_credentials",
            description: "Call this immediately if an action requires credentials (e.g. 'airtable', 'snowflake', 'airflow') that are missing. It tells the frontend UI to prompt the user securely.",
            inputSchema: { json: { type: "object", properties: { serviceName: { type: "string" } }, required: ["serviceName"] } }
        }
    }
];






export const NATIVE_TOOLS_REGISTRY = [
    // --- Multimodal & Asset Renders ---
    { 
        toolSpec: { 
            name: "generate_luma_video", 
            description: "Generates realistic video content using Luma Dream Machine / Ray.", 
            inputSchema: { json: { type: "object", properties: { prompt: { type: "string" }, aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1"] } }, required: ["prompt"] } } 
        } 
    },
    { 
        toolSpec: { 
            name: "generate_audio", 
            description: "Converts text to spoken audio using Amazon Polly Generative Engine.", 
            inputSchema: { json: { type: "object", properties: { text: { type: "string" }, voiceId: { type: "string" } }, required: ["text"] } } 
        } 
    },
    { 
        toolSpec: { 
            name: "generate_image", 
            description: "Generates high-fidelity images using Stability AI SD3.5 Large.", 
            inputSchema: { json: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } 
        } 
    },
    { 
        toolSpec: { 
            name: "generate_enterprise_image", 
            description: "Generates enterprise images using Amazon Titan Image Generator v2.", 
            inputSchema: { json: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } 
        } 
    },
    { 
        toolSpec: { 
            name: "edit_image", 
            description: "Edits existing image assets using Amazon Nova Canvas.", 
            inputSchema: { json: { type: "object", properties: { prompt: { type: "string" }, taskType: { type: "string" } }, required: ["prompt"] } } 
        } 
    },

    // --- Data & Pipeline Engineering ---
    {
    toolSpec: {
        name: 'airtable_data_agent',
        description: "Interacts with Airtable to inspect schemas, query records, write new data, and ingest parsed Excel files directly into tables.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["INSPECT_SCHEMA", "QUERY_RECORDS", "CREATE_RECORDS", "INGEST_SPREADSHEET"],
                        description: "The Airtable action to execute."
                    },
                    baseId: { type: "string", description: "The Airtable Base ID (starts with 'app')." },
                    tableIdOrName: { type: "string", description: "The Table ID or exact Table Name." },
                    queryParams: { type: "string", description: "URL-encoded query parameters for QUERY_RECORDS (e.g., 'maxRecords=10&view=Grid%20view')." },
                    recordsData: { type: "string", description: "Stringified JSON array of record objects for CREATE_RECORDS (e.g., '[{\"fields\": {\"Name\": \"John\"}}]')." },
                    fileUrl: { type: "string", description: "A valid URL to an Excel (.xlsx) file to parse and ingest." }
                },
                required: ["action", "baseId"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'snowflake_data_agent',
        description: "Executes SQL queries against a Snowflake data warehouse using JWT Keypair authentication. Supports reading tables, describing schemas, and manipulating data.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    sqlQuery: { type: "string", description: "The raw SQL statement to execute." },
                    database: { type: "string", description: "The Snowflake database name." },
                    schemaName: { type: "string", description: "The target schema name." },
                    warehouse: { type: "string", description: "The target compute warehouse (e.g., 'DATA_SCIENCE_WH'). If omitted, defaults to user's default warehouse." },
                    role: { type: "string", description: "The IAM role to assume for the query (e.g., 'SYSADMIN')." }
                },
                required: ["sqlQuery", "database", "schemaName"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'airflow_pipeline_agent',
        description: "Manages Apache Airflow data pipelines. Validates and deploys new Python DAG scripts to a designated S3 bucket, triggers pipeline runs, and fetches execution logs.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GENERATE_AND_DEPLOY_DAG", "TRIGGER_DAG", "GET_DAG_RUNS", "GET_FAILED_TASKS"],
                        description: "The Airflow action to execute."
                    },
                    dagId: { type: "string", description: "The ID of the DAG (Required for triggers and logs)." },
                    dagRunId: { type: "string", description: "The specific DAG Run ID (Required to fetch failed tasks)." },
                    logicalDate: { type: "string", description: "Optional ISO-8601 logical execution date for TRIGGER_DAG." },
                    dagPythonCode: { type: "string", description: "Raw Python source code of the DAG. Required for GENERATE_AND_DEPLOY_DAG." },
                    dagFilename: { type: "string", description: "The desired filename for the deployed DAG (e.g., 'sales_etl.py')." },
                },
                required: ["action"]
            }
                        }
                }
    },

    // --- Enterprise HR & Operations Command Center ---
    {
    toolSpec: {
        name: 'rippling_hr_agent',
        description: "Manages employee records in Rippling, including fetching employee details, onboarding new hires, updating roles/compensation, and processing terminations.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_EMPLOYEE", "ONBOARD_EMPLOYEE", "UPDATE_EMPLOYEE", "TERMINATE_EMPLOYEE"],
                        description: "The employee lifecycle action to perform."
                    },
                    employeeId: { 
                        type: "string", 
                        description: "The unique ID of the target employee in Rippling. Required for GET_EMPLOYEE, UPDATE_EMPLOYEE, and TERMINATE_EMPLOYEE." 
                    },
                    employeeData: { 
                        type: "string", 
                        description: "A stringified JSON string containing employee attribute updates or payload (e.g., job title, salary, manager, work email, or termination reason/effective date). Required for ONBOARD_EMPLOYEE, UPDATE_EMPLOYEE, and TERMINATE_EMPLOYEE." 
                    }
                },
                required: ["action"]
                }
                    }
            }
    },
    {
    toolSpec: {
        name: 'bamboohr_agent',
        description: "Manages employee directory, organizational structure, and time-off/PTO requests.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_DIRECTORY", "GET_TIME_OFF", "APPROVE_TIME_OFF"],
                        description: "The HR action to perform."
                    },
                    searchName: { type: "string", description: "Use with GET_DIRECTORY. Name to search for to prevent massive data dumps." },
                    startDate: { type: "string", description: "Use with GET_TIME_OFF. Format YYYY-MM-DD." },
                    endDate: { type: "string", description: "Use with GET_TIME_OFF. Format YYYY-MM-DD." },
                    requestId: { type: "string", description: "Use with APPROVE_TIME_OFF. The ID of the PTO request." },
                    status: { type: "string", enum: ["approved", "denied"], description: "Use with APPROVE_TIME_OFF." }
                },
                required: ["action"]
            }
                }
            }
    },
    {
    toolSpec: {
        name: 'zendesk_support_agent',
        description: "Manages Zendesk support tickets and Knowledge Base articles. Supports triaging, ticket creation, updating status/fields, and adding public or internal comments.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["TRIAGE_TICKETS", "SEARCH_KB", "CREATE_TICKET", "UPDATE_TICKET", "ADD_COMMENT"],
                        description: "The Zendesk action to execute."
                    },
                    query: { type: "string", description: "Search query string for TRIAGE_TICKETS or SEARCH_KB." },
                    ticketId: { type: "string", description: "The Zendesk Ticket ID. Required for UPDATE_TICKET and ADD_COMMENT." },
                    commentText: { type: "string", description: "Body of the comment to add to the ticket. Required for ADD_COMMENT." },
                    isPublic: { type: "boolean", description: "Used with ADD_COMMENT. Set to false for private internal notes, true for customer-facing comments. Default: false." },
                    ticketData: { type: "string", description: "Stringified JSON of ticket fields to create or update (e.g. '{\"subject\": \"Issue\", \"status\": \"open\"}'). Required for CREATE_TICKET and UPDATE_TICKET." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'servicenow_itsm_agent',
        description: "Interacts with ServiceNow ITSM. Fetches incidents by Number (INC0010001) or sys_id, searches active incident lists, creates new incidents, and resolves incidents.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_INCIDENT", "QUERY_INCIDENTS", "CREATE_INCIDENT", "RESOLVE_INCIDENT"],
                        description: "The ServiceNow ITSM action to execute."
                    },
                    incidentId: { type: "string", description: "Incident Number (e.g. INC0010001) or 32-character sys_id. Required for GET_INCIDENT and RESOLVE_INCIDENT." },
                    query: { type: "string", description: "ServiceNow encoded query string for QUERY_INCIDENTS (e.g. 'active=true^priority=1')." },
                    shortDescription: { type: "string", description: "Brief summary of the incident. Required for CREATE_INCIDENT." },
                    urgency: { type: "string", enum: ["1", "2", "3"], description: "Urgency: 1 (High), 2 (Medium), 3 (Low). Used for CREATE_INCIDENT." },
                    impact: { type: "string", enum: ["1", "2", "3"], description: "Impact: 1 (High), 2 (Medium), 3 (Low). Used for CREATE_INCIDENT." },
                    assignmentGroup: { type: "string", description: "Target ServiceNow assignment group name or sys_id." },
                    resolutionNotes: { type: "string", description: "Required for RESOLVE_INCIDENT. Detailed explanation of how the issue was resolved." },
                    closeCode: { type: "string", description: "Resolution close code for RESOLVE_INCIDENT (e.g., 'Solved (Permanently)', 'Workaround Provided')." }
                },
                required: ["action"]
            }
                        }
            }
    },
    {
    toolSpec: {
        name: 'pagerduty_sre_agent',
        description: "Manages PagerDuty incidents and SRE operations. Lists open incidents, checks who is on-call, triggers new incidents, acknowledges/resolves alerts, and adds notes to incidents.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["LIST_ALERTS", "RUN_DIAGNOSTICS", "GET_ON_CALL", "TRIGGER_INCIDENT", "ACKNOWLEDGE_INCIDENT", "RESOLVE_INCIDENT", "ADD_NOTE"],
                        description: "The SRE operational action to execute."
                    },
                    incidentId: { type: "string", description: "The PagerDuty Incident ID (e.g. P123456). Required for ACKNOWLEDGE_INCIDENT, RESOLVE_INCIDENT, and ADD_NOTE." },
                    serviceId: { type: "string", description: "PagerDuty Service ID (e.g. P12345). Required for TRIGGER_INCIDENT." },
                    title: { type: "string", description: "Incident title/summary. Required for TRIGGER_INCIDENT." },
                    urgency: { type: "string", enum: ["high", "low"], description: "Urgency level for TRIGGER_INCIDENT." },
                    noteText: { type: "string", description: "Content of the note to attach to the incident. Required for ADD_NOTE." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'jira_agile_agent',
        description: "Manages Jira issues and agile boards. Can search tickets via JQL, create/update issues, transition states, and add comments.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["SEARCH_ISSUES", "CREATE_ISSUE", "GET_ISSUE", "UPDATE_ISSUE", "TRANSITION_ISSUE", "ADD_COMMENT"],
                        description: "The Jira action to execute."
                    },
                    issueKey: { type: "string", description: "The Jira Issue Key (e.g., 'PROJ-123'). Required for GET, UPDATE, TRANSITION, and ADD_COMMENT." },
                    jqlQuery: { type: "string", description: "JQL (Jira Query Language) string for SEARCH_ISSUES." },
                    issueData: { type: "string", description: "Stringified JSON object for CREATE_ISSUE or UPDATE_ISSUE payloads." },
                    transitionId: { type: "string", description: "The ID of the transition state to move the ticket to. Required for TRANSITION_ISSUE." },
                    commentBody: { type: "string", description: "The text of the comment to post. Required for ADD_COMMENT." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'confluence_wiki_agent',
        description: "Manages Confluence wiki pages. Can search via CQL, read page content, and create/update pages.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["SEARCH_PAGES", "GET_PAGE", "CREATE_PAGE", "UPDATE_PAGE"],
                        description: "The Confluence action to execute."
                    },
                    pageId: { type: "string", description: "The Confluence Page ID. Required for GET_PAGE and UPDATE_PAGE." },
                    cqlQuery: { type: "string", description: "CQL (Confluence Query Language) string for SEARCH_PAGES." },
                    pageData: { type: "string", description: "Stringified JSON object payload for CREATE_PAGE or UPDATE_PAGE." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'asana_pm_agent',
        description: "Manages Asana tasks and projects. Can search tasks, fetch task details, and create/update tasks.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["SEARCH_TASKS", "GET_TASK", "CREATE_TASK", "UPDATE_TASK"],
                        description: "The Asana action to execute."
                    },
                    workspaceId: { type: "string", description: "The Asana Workspace ID. Required for SEARCH_TASKS." },
                    taskId: { type: "string", description: "The Asana Task ID. Required for GET_TASK and UPDATE_TASK." },
                    query: { type: "string", description: "Text query for SEARCH_TASKS." },
                    taskData: { type: "string", description: "Stringified JSON object for CREATE_TASK or UPDATE_TASK payloads." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'notion_workspace_agent',
        description: "Manages Notion workspace pages and databases. Can search workspaces, retrieve page metadata, read actual page content blocks, and create/update pages.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["SEARCH_PAGES", "GET_PAGE", "GET_PAGE_CONTENT", "CREATE_PAGE", "UPDATE_PAGE"],
                        description: "The Notion action to execute."
                    },
                    pageId: { type: "string", description: "The Notion Page ID. Required for GET_PAGE, GET_PAGE_CONTENT, and UPDATE_PAGE." },
                    query: { type: "string", description: "Search string for SEARCH_PAGES." },
                    pageData: { type: "string", description: "Stringified JSON object for CREATE_PAGE or UPDATE_PAGE payloads." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'contentful_cms_agent',
        description: "Manages Contentful headless CMS data. Can retrieve or create/update content entries.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_ENTRIES", "GET_ENTRY", "CREATE_ENTRY", "UPDATE_ENTRY"],
                        description: "The Contentful action to execute."
                    },
                    contentType: { type: "string", description: "The Contentful Content Type ID. Required for GET_ENTRIES, CREATE_ENTRY, and UPDATE_ENTRY." },
                    entryId: { type: "string", description: "The unique Entry ID. Required for GET_ENTRY and UPDATE_ENTRY." },
                    entryData: { type: "string", description: "Stringified JSON payload representing entry fields for CREATE_ENTRY or UPDATE_ENTRY." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'sanity_cms_agent',
        description: "Manages Sanity.io CMS data. Can run GROQ queries and execute document mutations.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["QUERY_DOCUMENTS", "MUTATE_DOCUMENT"],
                        description: "The Sanity action to execute."
                    },
                    groqQuery: { type: "string", description: "GROQ query string. Required for QUERY_DOCUMENTS." },
                    mutations: { type: "string", description: "Stringified JSON array of Sanity mutation objects. Required for MUTATE_DOCUMENT." }
                },
                required: ["action"]
            }
                    }
            }
    },
    // ==========================================
// GOOGLE WORKSPACE AGENT SCHEMA
// ==========================================
    {
    toolSpec: {
        name: 'google_workspace_agent',
        description: "Manages Google Workspace apps including Gmail, Drive, Docs, Sheets, Slides, and Google Calendar. Performs search across Drive, handles file/document reads, creates docs, and manages calendar events/free-busy lookups.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "SEARCH_DRIVE", 
                            "READ_GMAIL", 
                            "SEND_GMAIL", 
                            "READ_DOC", 
                            "CREATE_DOC", 
                            "READ_SHEET", 
                            "READ_SLIDES",
                            "LIST_CALENDAR_EVENTS",
                            "CREATE_CALENDAR_EVENT",
                            "GET_FREE_BUSY"
                        ],
                        description: "The Google Workspace action to execute. Use SEARCH_DRIVE if a file/doc ID is missing, or Google Calendar actions for scheduling."
                    },
                    query: { type: "string", description: "Search query for SEARCH_DRIVE, READ_GMAIL, or LIST_CALENDAR_EVENTS filtering." },
                    documentId: { type: "string", description: "Google Drive File ID. Required for READ_DOC, READ_SHEET, and READ_SLIDES." },
                    title: { type: "string", description: "Title for creating a new Google Doc." },
                    payload: { type: "string", description: "Stringified JSON payload. For SEND_GMAIL: {\"to\":\"...\",\"subject\":\"...\",\"body\":\"...\"}. For CREATE_CALENDAR_EVENT: {\"summary\":\"...\",\"startTime\":\"ISO8601\",\"endTime\":\"ISO8601\",\"attendees\":[\"email@co.com\"]}" },
                    calendarId: { type: "string", description: "Target Calendar ID. Default is 'primary'." },
                    startTime: { type: "string", description: "ISO-8601 string for start time (e.g. '2026-09-01T10:00:00Z'). Used for calendar events, event listing, or free/busy queries." },
                    endTime: { type: "string", description: "ISO-8601 string for end time (e.g. '2026-09-01T11:00:00Z'). Used for calendar events, event listing, or free/busy queries." },
                    summary: { type: "string", description: "Title or summary of the meeting event for CREATE_CALENDAR_EVENT." },
                    description: { type: "string", description: "Description or agenda notes for CREATE_CALENDAR_EVENT." },
                    attendees: { type: "string", description: "JSON string array of attendee emails (e.g., '[\"person1@co.com\", \"person2@co.com\"]') for CREATE_CALENDAR_EVENT." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'slack_collaboration_agent',
        description: "Interacts with Slack. Can read channel history and post messages.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["READ_CHANNEL_HISTORY", "POST_MESSAGE"],
                        description: "The Slack action to execute."
                    },
                    channelId: { type: "string", description: "The Slack Channel ID. Required for all actions." },
                    message: { type: "string", description: "The message text to post. Required for POST_MESSAGE." }
                },
                required: ["action", "channelId"]
            }
                    }
            }
    },
    // --- Enterprise Software Development ---
    {
    toolSpec: {
        name: 'github_developer_agent',
        description: "Interacts with GitHub repositories. Inspects repository structures, searches code, reads/writes files, creates branches, manages Pull Requests, fetches PR diffs for code reviews, and manages Issues.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "GET_REPO", "GET_TREE", "SEARCH_CODE", "GET_FILE", 
                            "CREATE_BRANCH", "CREATE_OR_UPDATE_FILE", "CREATE_PULL_REQUEST", 
                            "GET_PR_FILES", "MERGE_PULL_REQUEST", "CREATE_ISSUE"
                        ],
                        description: "The GitHub action to perform."
                    },
                    owner: { type: "string", description: "Repository owner or organization name (e.g., 'octocat')." },
                    repo: { type: "string", description: "Repository name (e.g., 'Hello-World')." },
                    path: { type: "string", description: "File or directory path in the repository (e.g., 'src/index.ts'). Required for GET_FILE and CREATE_OR_UPDATE_FILE." },
                    branch: { type: "string", description: "Target branch name for file operations or tree fetching." },
                    sourceBranch: { type: "string", description: "Source branch for creating a branch or opening/merging PRs." },
                    targetBranch: { type: "string", description: "Target base branch for Pull Requests (e.g., 'main')." },
                    commitMessage: { type: "string", description: "Commit message for file updates or PR merges." },
                    fileContent: { type: "string", description: "Raw file string content to commit." },
                    pullRequestTitle: { type: "string", description: "Title of the Pull Request." },
                    pullRequestBody: { type: "string", description: "Description or markdown body of the Pull Request." },
                    pullRequestNumber: { type: "number", description: "Pull Request ID number. Required for GET_PR_FILES and MERGE_PULL_REQUEST." },
                    query: { type: "string", description: "Code search query string for SEARCH_CODE." },
                    issueTitle: { type: "string", description: "Title for creating an Issue." },
                    issueBody: { type: "string", description: "Body text or markdown description for an Issue." }
                },
                required: ["action", "owner", "repo"]
            }
                    }
                            }
    },
    {
    toolSpec: {
        name: 'gitlab_developer_agent',
        description: "Interacts with GitLab projects. Fetches repository trees, reads/commits files, manages branches, opens Merge Requests, fetches MR diffs for automated code review, and creates Issues.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "GET_PROJECT", "GET_TREE", "GET_FILE", "CREATE_BRANCH", 
                            "COMMIT_FILE", "CREATE_MERGE_REQUEST", "GET_MR_CHANGES", 
                            "ACCEPT_MERGE_REQUEST", "CREATE_ISSUE"
                        ],
                        description: "The GitLab action to perform."
                    },
                    projectId: { type: "string", description: "GitLab Project ID or URL-encoded path (e.g., '12345' or 'group/project')." },
                    filePath: { type: "string", description: "File path in repository. Required for GET_FILE and COMMIT_FILE." },
                    branch: { type: "string", description: "Target branch for file reads or commits." },
                    sourceBranch: { type: "string", description: "Source branch for branch creation or Merge Requests." },
                    targetBranch: { type: "string", description: "Target branch for Merge Requests." },
                    commitMessage: { type: "string", description: "Commit message." },
                    fileContent: { type: "string", description: "Raw content for file commit." },
                    fileAction: { type: "string", enum: ["create", "update", "delete"], description: "Action type for COMMIT_FILE." },
                    mergeRequestTitle: { type: "string", description: "Title of the Merge Request." },
                    mergeRequestBody: { type: "string", description: "Description of the Merge Request." },
                    mergeRequestIid: { type: "number", description: "Merge Request IID. Required for GET_MR_CHANGES and ACCEPT_MERGE_REQUEST." },
                    issueTitle: { type: "string", description: "Title for creating a GitLab Issue." },
                    issueDescription: { type: "string", description: "Description text for a GitLab Issue." }
                },
                required: ["action", "projectId"]
            }
                        }
                }
    },
    // --- Enterprise Site Reliability Engineering (SRE) ---
    {
    toolSpec: {
        name: 'grafana_observability_agent',
        description: "Manages Grafana dashboards, data sources, alert rules, and performs PromQL metric queries and LogQL log searches.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "GET_DATA_SOURCES", "SEARCH_DASHBOARDS", "GET_DASHBOARD", 
                            "QUERY_METRICS", "QUERY_METRICS_RANGE", "QUERY_LOKI_LOGS", 
                            "CREATE_DASHBOARD", "GET_ALERT_RULES"
                        ],
                        description: "The Grafana action to execute."
                    },
                    dataSourceUid: { type: "string", description: "The Grafana Data Source UID. Required for metric and log queries." },
                    dashboardUid: { type: "string", description: "The UID of the dashboard. Required for GET_DASHBOARD." },
                    query: { type: "string", description: "PromQL query string (for metrics) or LogQL query string (for Loki logs), or dashboard search string." },
                    start: { type: "string", description: "Start time for range queries (Unix timestamp in seconds or ISO string)." },
                    end: { type: "string", description: "End time for range queries (Unix timestamp in seconds or ISO string)." },
                    step: { type: "string", description: "Resolution step for PromQL range queries (e.g., '15s', '1m'). Default: '15s'." },
                    limit: { type: "number", description: "Maximum number of Loki log lines to retrieve. Default: 50." },
                    dashboardJson: { type: "string", description: "Stringified JSON object representing the full Grafana dashboard model." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
    toolSpec: {
        name: 'datadog_monitoring_agent',
        description: "Interacts with Datadog. Queries logs and metric series, manages dashboards, checks active alerting monitors, mutes monitors, retrieves open incidents, and inspects SLOs.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "QUERY_LOGS", "QUERY_METRICS", "SEARCH_DASHBOARDS", 
                            "CREATE_DASHBOARD", "GET_MONITORS", "MUTE_MONITOR", 
                            "LIST_INCIDENTS", "GET_SLOS"
                        ],
                        description: "The Datadog action to execute."
                    },
                    query: { type: "string", description: "Metric query string (e.g. 'avg:system.cpu.user{*}') or log search query (e.g. 'service:web-app status:error')." },
                    from: { type: "string", description: "Start time (Unix timestamp in seconds or ISO string)." },
                    to: { type: "string", description: "End time (Unix timestamp in seconds or ISO string)." },
                    monitorId: { type: "string", description: "The Datadog Monitor ID. Required for MUTE_MONITOR." },
                    muteScope: { type: "string", description: "Optional scope string to mute specific environment/host tags (e.g. 'env:prod,host:web-01')." },
                    dashboardJson: { type: "string", description: "Stringified JSON object of the Datadog dashboard payload." }
                },
                required: ["action"]
            }
                    }
             }
    },
    // --- Enterprise Property Management ---
    {
    toolSpec: {
        name: 'butterflymx_access_agent',
        description: "Manages ButterflyMX building access control for both Property Managers and Tenants. Can manage virtual keys for guests/deliveries, open doors, update tenant PINs/privacy, and check access logs.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "GET_BUILDINGS", "GET_TENANTS", "GET_DEVICES", 
                            "GET_ACCESS_LOGS", "GET_MY_ACCESS_LOGS", "OPEN_DOOR", 
                            "CREATE_VIRTUAL_KEY", "REVOKE_VIRTUAL_KEY", "UPDATE_TENANT"
                        ],
                        description: "The ButterflyMX action to execute. Use GET_MY_ACCESS_LOGS for tenant-scoped history."
                    },
                    buildingId: { type: "string", description: "The ButterflyMX Building ID." },
                    tenantId: { type: "string", description: "The ButterflyMX Tenant ID. Required for GET_MY_ACCESS_LOGS and UPDATE_TENANT." },
                    deviceId: { type: "string", description: "The ButterflyMX Device/Door ID. Required for OPEN_DOOR." },
                    virtualKeyId: { type: "string", description: "The Virtual Key ID. Required for REVOKE_VIRTUAL_KEY." },
                    virtualKeyData: { type: "string", description: "Stringified JSON representing virtual key attributes (e.g. name, start_time, end_time)." },
                    tenantData: { type: "string", description: "Stringified JSON representing tenant updates. For PIN changes: {\"pin\":\"1234\"}. For privacy: {\"directory_hidden\": true}." }
                },
                required: ["action"]
            }
                    }
                }
    },
    {
    toolSpec: {
        name: 'yardi_virtuoso_agent',
        description: "Interacts with Yardi Virtuoso Property Management system via a Model Context Protocol (MCP) server. If you do not know the exact tool name required for a task (e.g. resident ledgers, work orders), run LIST_YARDI_TOOLS first to discover them.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["LIST_YARDI_TOOLS", "CALL_YARDI_TOOL"],
                        description: "The action to execute. Use LIST_YARDI_TOOLS to discover capabilities, and CALL_YARDI_TOOL to execute one."
                    },
                    mcpToolName: { type: "string", description: "The specific Yardi MCP tool name to call (e.g., 'create_work_order'). Required for CALL_YARDI_TOOL." },
                    mcpArguments: { type: "string", description: "Stringified JSON arguments required by the specific Yardi MCP tool." }
                },
                required: ["action"]
            }
                    }
             }
    },
    // --- Enterprise Core Business Operations ---
    {
    toolSpec: {
        name: 'salesforce_crm_agent',
        description: "Manages Salesforce CRM records. Can run SOQL queries, execute CRUD operations on standard/custom objects (Accounts, Contacts, Opportunities, Cases), and log activities.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["SOQL_QUERY", "GET_RECORD", "CREATE_RECORD", "UPDATE_RECORD", "LOG_ACTIVITY"],
                        description: "The Salesforce action to execute."
                    },
                    query: { type: "string", description: "SOQL query string. Required for SOQL_QUERY." },
                    objectName: { type: "string", description: "The API name of the Salesforce object (e.g., 'Account', 'Contact', 'Case'). Required for GET, CREATE, UPDATE." },
                    recordId: { type: "string", description: "The 18-character Salesforce Record ID. Required for GET, UPDATE, and LOG_ACTIVITY." },
                    recordData: { type: "string", description: "Stringified JSON object of field values. For LOG_ACTIVITY, provide {'Subject':'...', 'Description':'...', 'Status':'Completed'}." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
        toolSpec: {
            name: "sap_erp_agent",
            description: "SAP ERP OData agent. Queries lead time analysis, product lines, and business partners via SAP REST/OData API.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["ODATA_GET", "ODATA_POST"] }, 
                        endpoint: { type: "string", description: "SAP OData endpoint path (e.g., /sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder)." },
                        payload: { type: "string", description: "JSON stringified payload for POST requests." }
                    }, 
                    required: ["action", "endpoint"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "dynamics_365_agent",
            description: "Microsoft Dynamics 365 agent. Tracks leads, production orchestration, and retrieves Web API records.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["RETRIEVE_RECORDS", "CREATE_RECORD", "UPDATE_RECORD"] }, 
                        entityPluralName: { type: "string", description: "Entity set name (e.g., leads, opportunities)." },
                        queryOptions: { type: "string", description: "OData query options (e.g., $select=name&$top=10)." },
                        recordId: { type: "string", description: "Dynamics 365 Record GUID." },
                        payload: { type: "string", description: "JSON stringified payload." }
                    }, 
                    required: ["action", "entityPluralName"] 
                } 
            }
        }
    },
    {
    toolSpec: {
        name: 'hubspot_crm_agent',
        description: "Manages HubSpot CRM objects (Contacts, Companies, Deals, Tickets). Can search, execute CRUD operations, and log engagements/notes to records.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["SEARCH_OBJECTS", "GET_OBJECT", "CREATE_OBJECT", "UPDATE_OBJECT", "LOG_ENGAGEMENT"],
                        description: "The HubSpot action to execute."
                    },
                    objectType: { type: "string", description: "The plural type of the object (e.g., 'contacts', 'companies', 'deals', 'tickets'). Required for all actions." },
                    objectId: { type: "string", description: "The specific Object ID. Required for GET, UPDATE, and LOG_ENGAGEMENT." },
                    searchQuery: { type: "string", description: "Stringified JSON of the HubSpot search payload (filterGroups). Required for SEARCH_OBJECTS." },
                    payload: { type: "string", description: "Stringified JSON of properties to create/update. For LOG_ENGAGEMENT, provide {'hs_note_body':'...'}." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
        toolSpec: {
            name: "linkedin_sales_agent",
            description: "LinkedIn Sales Navigator agent. Retrieves lead and account information to provide RAG-augmented insights.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["SEARCH_LEADS", "GET_ACCOUNT"] }, 
                        query: { type: "string", description: "Search query for leads or companies." },
                        accountId: { type: "string", description: "LinkedIn Account or Profile ID." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
    toolSpec: {
        name: 'uipath_orchestrator_agent',
        description: "Manages UiPath RPA processes, jobs, and queues. Use GET_RELEASES to find process UUIDs. Use GET_JOB_LOGS to diagnose failed bots.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: [
                            "GET_RELEASES", "GET_JOBS", "GET_JOB_LOGS", 
                            "START_JOB", "STOP_JOB", 
                            "GET_QUEUE_ITEMS", "ADD_QUEUE_ITEM"
                        ],
                        description: "The UiPath Orchestrator action to execute."
                    },
                    releaseKey: { type: "string", description: "The UUID of the deployed process. Required for START_JOB. Find this using GET_RELEASES." },
                    jobId: { type: "number", description: "The numeric Job ID. Required for GET_JOB_LOGS and STOP_JOB." },
                    queueName: { type: "string", description: "The exact name of the Orchestrator Queue. Required for GET_QUEUE_ITEMS and ADD_QUEUE_ITEM." },
                    statusFilter: { type: "string", enum: ["New", "In Progress", "Failed", "Successful", "Abandoned"], description: "Optional filter for GET_QUEUE_ITEMS to only return items with a specific status." },
                    payload: { type: "string", description: "Stringified JSON object. For START_JOB, represents Input Arguments. For ADD_QUEUE_ITEM, represents Specific Content payload." }
                },
                required: ["action"]
            }
                    }
                }
    },
    {
        toolSpec: {
            name: 'booking_com_agent',
            description: "Manages Booking.com accommodations. Can search properties, fetch details, read reviews, and check order statuses.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["SEARCH_PROPERTIES", "GET_PROPERTY_DETAILS", "GET_REVIEWS", "GET_ORDER_DETAILS"]
                        },
                        query: { type: "string", description: "Search term (e.g., 'London', 'Hilton Paris')." },
                        checkIn: { type: "string", description: "YYYY-MM-DD" },
                        checkOut: { type: "string", description: "YYYY-MM-DD" },
                        adults: { type: "number", description: "Number of adults (default 1)." },
                        currency: { type: "string", description: "3-letter currency code (e.g., 'USD', 'EUR')." },
                        propertyId: { type: "string", description: "The Booking.com Property ID." },
                        orderId: { type: "string", description: "The Booking.com Order/Reservation ID." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: 'priceline_partner_agent',
            description: "Manages Priceline hotel bookings. Can search hotels, fetch details, and retrieve or cancel reservations.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["SEARCH_HOTELS", "GET_HOTEL_DETAILS", "GET_REVIEWS", "GET_RESERVATION", "CANCEL_RESERVATION"]
                        },
                        destination: { type: "string", description: "City or location name." },
                        hotelId: { type: "string", description: "The Priceline Hotel ID." },
                        reservationId: { type: "string", description: "The Priceline Reservation ID." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: 'amadeus_gds_agent',
            description: "Global Distribution System (GDS) tool for Travel Agents. Searches live flight offers, seat availability, and manages flight orders.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["SEARCH_FLIGHTS", "GET_FLIGHT_ORDER"]
                        },
                        origin: { type: "string", description: "3-letter IATA Airport Code (e.g., 'JFK')." },
                        destination: { type: "string", description: "3-letter IATA Airport Code (e.g., 'LHR')." },
                        departureDate: { type: "string", description: "YYYY-MM-DD" },
                        returnDate: { type: "string", description: "YYYY-MM-DD (Optional for round trips)." },
                        adults: { type: "number", description: "Number of adult passengers." },
                        flightOrderId: { type: "string", description: "The Amadeus Flight Order ID." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: "vrbo_property_agent",
            description: "Vrbo property management and booking agent. Manages listings, real-time rates, availability calendars, reservations, and guest feedback.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_LISTING", "UPDATE_RATES", "GET_AVAILABILITY", "GET_RESERVATION", "GET_REVIEWS"] }, 
                        propertyId: { type: "string", description: "Vrbo Property ID." },
                        reservationId: { type: "string", description: "Vrbo Reservation ID." },
                        payload: { type: "string", description: "JSON stringified payload for rate updates." },
                        startDate: { type: "string", description: "YYYY-MM-DD format." },
                        endDate: { type: "string", description: "YYYY-MM-DD format." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    // --- Enterprise Full Stack Developer (MCP Wrappers) ---
    {
        toolSpec: {
            name: 'mito_mcp_agent',
            description: "Interacts with the Mito enterprise MCP server. If you do not know the exact tool name required for a task, run LIST_TOOLS first to discover them.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["LIST_TOOLS", "CALL_TOOL"],
                            description: "The action to execute. Use LIST_TOOLS to discover capabilities."
                        },
                        mcpToolName: { type: "string", description: "The specific MCP tool name to call. Required for CALL_TOOL." },
                        mcpArguments: { type: "string", description: "Stringified JSON arguments required by the specific MCP tool." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: 'apotheosis_mcp_agent',
            description: "Interacts with the Apotheosis creative/UX MCP server. If you do not know the exact tool name required for a task, run LIST_TOOLS first to discover them.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["LIST_TOOLS", "CALL_TOOL"],
                            description: "The action to execute. Use LIST_TOOLS to discover capabilities."
                        },
                        mcpToolName: { type: "string", description: "The specific MCP tool name to call. Required for CALL_TOOL." },
                        mcpArguments: { type: "string", description: "Stringified JSON arguments required by the specific MCP tool." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: 'byo_mcp_agent',
            description: "Interacts with the user's custom 'Bring Your Own' MCP server (e.g. local file readers, custom Figma bridges). If you do not know the exact tool name required for a task, run LIST_TOOLS first to discover them.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["LIST_TOOLS", "CALL_TOOL"],
                            description: "The action to execute. Use LIST_TOOLS to discover capabilities."
                        },
                        mcpToolName: { type: "string", description: "The specific MCP tool name to call. Required for CALL_TOOL." },
                        mcpArguments: { type: "string", description: "Stringified JSON arguments required by the specific MCP tool." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    // --- Enterprise Smart Home Management ---
    {
    toolSpec: {
        name: 'google_home_agent',
        description: "Manages Google Home / Nest devices via the Smart Device Management (SDM) API. Can list structures/devices and execute commands.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_DEVICES", "GET_ROOMS", "CONTROL_DEVICE", "MANAGE_ROOM"],
                        description: "The Google Home action to execute."
                    },
                    deviceId: { type: "string", description: "The Google Device ID. Required for CONTROL_DEVICE." },
                    command: { type: "string", description: "The SDM API Command (e.g., 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat'). Required for CONTROL_DEVICE." },
                    params: { type: "string", description: "Stringified JSON object of command parameters (e.g., '{\"heatCelsius\": 22}')." }
                },
                required: ["action"]
            }
                        }
                }
    },
    {
    toolSpec: {
        name: 'home_assistant_agent',
        description: "Manages a Home Assistant smart home instance. Can view entities, call services (control devices), troubleshoot using entity history or error logs, and render Jinja2 templates.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_DEVICES", "CONTROL_DEVICE", "GET_HISTORY", "GET_ERROR_LOGS", "RENDER_TEMPLATE"],
                        description: "The Home Assistant action to execute."
                    },
                    domain: { type: "string", description: "The service domain (e.g., 'light', 'climate', 'script'). Required for CONTROL_DEVICE." },
                    service: { type: "string", description: "The service name (e.g., 'turn_on', 'set_temperature'). Required for CONTROL_DEVICE." },
                    entityId: { type: "string", description: "The specific entity ID (e.g., 'light.living_room'). Required for GET_HISTORY and optional for CONTROL_DEVICE." },
                    serviceData: { type: "string", description: "Stringified JSON of service payload attributes (e.g., '{\"brightness\": 255}')." },
                    startTime: { type: "string", description: "ISO-8601 timestamp to start historical data fetch (e.g., '2026-08-27T00:00:00Z'). Used in GET_HISTORY." },
                    templateString: { type: "string", description: "Jinja2 template string to render and test on the live instance. Required for RENDER_TEMPLATE." }
                },
                required: ["action"]
            }
                            }
                }
    },
    {
    toolSpec: {
        name: 'amazon_alexa_agent',
        description: "Controls Amazon Alexa devices via the Smart Home Event Gateway. Note: Device discovery is unsupported; user must provide exact Endpoint ID.",
        inputSchema: {
            json: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["GET_DEVICES", "CONTROL_DEVICE", "GET_ROOMS", "MANAGE_ROOM"],
                        description: "The Alexa action to execute."
                    },
                    endpointId: { type: "string", description: "The target Alexa Endpoint ID. Required for CONTROL_DEVICE." },
                    namespace: { type: "string", description: "The Alexa capability namespace (e.g., 'Alexa.PowerController')." },
                    name: { type: "string", description: "The Alexa directive name (e.g., 'TurnOn')." },
                    payload: { type: "string", description: "Stringified JSON object representing the event payload." }
                },
                required: ["action"]
            }
                    }
            }
    },
    {
        toolSpec: {
            name: 'generate_document_agent',
            description: "Generates downloadable files (HTML reports, CSV datasets, Markdown notes) and saves them securely to AWS S3. Use this when the user asks for a file, report, spreadsheet, or standalone document.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        format: { 
                            type: "string", 
                            enum: ["html", "csv", "md"],
                            description: "The file format. Use 'html' for professional reports, letters, and invoices. Use 'csv' for spreadsheets and data tables. Use 'md' for raw text/code."
                        },
                        fileName: { 
                            type: "string", 
                            description: "A short, descriptive file name without the extension (e.g., 'Q3-Financial-Report' or 'Meeting-Notes')." 
                        },
                        content: { 
                            type: "string", 
                            description: "The complete content of the file. If 'html', provide well-structured HTML elements (<h1>, <table>, <p>). If 'csv', provide comma-separated values with a header row." 
                        }
                    },
                    required: ["format", "fileName", "content"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: 'arduino_iot_agent',
            description: "Manages Arduino IoT Cloud microcontrollers. Can list Things, discover sensor Properties (telemetry), and update Properties to actuate hardware (e.g. spin motors, toggle relays).",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["GET_THINGS", "GET_PROPERTIES", "UPDATE_PROPERTY", "CREATE_PROPERTY"],
                            description: "The Arduino action to execute."
                        },
                        thingId: { type: "string", description: "The UUID of the Arduino Thing. Required for GET_PROPERTIES, UPDATE_PROPERTY, CREATE_PROPERTY." },
                        propertyId: { type: "string", description: "The UUID of the specific Property (variable). Required for UPDATE_PROPERTY." },
                        payload: { type: "string", description: "Stringified JSON object. For UPDATE_PROPERTY, provide {'value': <new_value>}." }
                    },
                    required: ["action"]
                }
            }
        }
    },
    {
        toolSpec: {
            name: 'raspberry_pi_fleet_agent',
            description: "Manages a fleet of Raspberry Pi edge devices (via balenaCloud). Can check online status, pull application logs for diagnostics, set environment variables, and trigger reboots.",
            inputSchema: {
                json: {
                    type: "object",
                    properties: {
                        action: { 
                            type: "string", 
                            enum: ["GET_FLEET_STATUS", "GET_DEVICE_LOGS", "REBOOT_DEVICE", "SET_DEVICE_ENV_VAR"],
                            description: "The Edge Fleet action to execute."
                        },
                        deviceUuid: { type: "string", description: "The UUID of the specific Raspberry Pi device. Required for logs, reboots, and env vars." },
                        envVars: { type: "string", description: "Stringified JSON for SET_DEVICE_ENV_VAR. Format: {'name': 'VAR_NAME', 'value': 'var_value'}." }
                    },
                    required: ["action"]
                }
            }
        }
    },
];

export const isValidUrl = (urlString: string) => {
            try { return Boolean(new URL(urlString)); }
            catch(e) { return false; }
        };