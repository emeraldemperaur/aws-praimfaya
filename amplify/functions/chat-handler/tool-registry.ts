
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
            name: "airtable_data_agent", 
            description: "Parses Airtable schema and ingests spreadsheets.", 
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["INSPECT_SCHEMA", "INGEST_SPREADSHEET", "ANALYZE_RELATIONS"] }, baseId: { type: "string" }, fileUrl: { type: "string" } }, required: ["action", "baseId"] } } 
        } 
    },
    { 
        toolSpec: { 
            name: "snowflake_data_agent", 
            description: "Executes analytical SQL queries against Snowflake Data Warehouses.", 
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["INSPECT_SCHEMA", "EXECUTE_ANALYTICAL_SQL"] }, database: { type: "string" }, schemaName: { type: "string" }, sqlQuery: { type: "string" } }, required: ["action", "database", "schemaName"] } } 
        } 
    },
    { 
        toolSpec: { 
            name: "airflow_pipeline_agent", 
            description: "Triggers DAG runs or validates and deploys Airflow DAG Python scripts.", 
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["TRIGGER_DAG_RUN", "GENERATE_AND_DEPLOY_DAG"] }, dagId: { type: "string" }, executionPayloadJson: { type: "string" }, dagPythonCode: { type: "string" } }, required: ["action"] } } 
        } 
    },

    // --- Enterprise HR & Operations Command Center ---
    {
        toolSpec: {
            name: "rippling_hr_agent",
            description: "Interfaces with Rippling to automate employee onboarding, device provisioning, and identity graph lookup.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["ONBOARD_EMPLOYEE", "GET_EMPLOYEE"] }, 
                        employeeId: { type: "string", description: "Rippling worker ID." }, 
                        employeeData: { type: "string", description: "JSON stringified worker payload containing hire details and laptop options." } 
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "bamboohr_agent",
            description: "Interfaces with BambooHR via API to read employee directories and time-off requests.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_DIRECTORY", "GET_TIME_OFF"] } 
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "zendesk_support_agent",
            description: "Conducts multi-intent triage on Zendesk support tickets, searches Zendesk Knowledge Base, and updates ticket status.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["TRIAGE_TICKETS", "SEARCH_KB", "UPDATE_TICKET"] }, 
                        ticketId: { type: "string", description: "Zendesk ticket ID." }, 
                        query: { type: "string", description: "Search query for tickets or KB articles." },
                        ticketData: { type: "string", description: "JSON stringified ticket update object (e.g. status, comments)." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "servicenow_itsm_agent",
            description: "IT Service Management agent for ServiceNow to conduct incident triage and resolution.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_INCIDENT", "RESOLVE_INCIDENT"] }, 
                        sysId: { type: "string", description: "ServiceNow incident sys_id." }, 
                        resolutionNotes: { type: "string", description: "Close notes when resolving an incident." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "pagerduty_sre_agent",
            description: "Virtual SRE integrated with PagerDuty to list alerts, run diagnostics, acknowledge, or resolve incidents.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["LIST_ALERTS", "RUN_DIAGNOSTICS", "ACKNOWLEDGE_INCIDENT", "RESOLVE_INCIDENT"] }, 
                        incidentId: { type: "string", description: "PagerDuty incident ID." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    // --- Enterprise Productivity & Agile Operations ---
    {
        toolSpec: {
            name: "jira_agile_agent",
            description: "Agile product operations tool for Jira. Reads, searches, and mutates tasks, stories, and epics to track agile development and determine user sentiment.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["SEARCH_ISSUES", "GET_ISSUE", "CREATE_ISSUE", "UPDATE_ISSUE"] }, jqlQuery: { type: "string" }, issueKey: { type: "string" }, issueData: { type: "string", description: "JSON stringified Jira issue payload." } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "confluence_wiki_agent",
            description: "Knowledge management agent for Confluence. Reads SOPs and deep-linked pages to discern holistic meaning, relationships, and organizational context.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["SEARCH_PAGES", "GET_PAGE", "CREATE_PAGE", "UPDATE_PAGE"] }, cqlQuery: { type: "string" }, pageId: { type: "string" }, pageData: { type: "string" } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "asana_pm_agent",
            description: "Product management agent for Asana. Manages tasks and user stories, tracks progress, and analyzes task structures.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["SEARCH_TASKS", "GET_TASK", "CREATE_TASK", "UPDATE_TASK"] }, workspaceId: { type: "string" }, taskId: { type: "string" }, taskData: { type: "string" } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "notion_workspace_agent",
            description: "Integrates with Notion to review tasks, issues, and pages. Discerns holistic meaning from deep-linked team databases.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["SEARCH_PAGES", "GET_PAGE", "CREATE_PAGE", "UPDATE_PAGE"] }, query: { type: "string" }, pageId: { type: "string" }, pageData: { type: "string" } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "contentful_cms_agent",
            description: "Headless CMS agent for Contentful. Reviews pages and models to discern relevance and content structure.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["GET_ENTRIES", "GET_ENTRY", "CREATE_ENTRY", "UPDATE_ENTRY"] }, entryId: { type: "string" }, entryData: { type: "string" }, contentType: { type: "string" } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "sanity_cms_agent",
            description: "Structured content agent for Sanity.io. Queries GROQ to analyze organizational content relationships.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["QUERY_DOCUMENTS", "MUTATE_DOCUMENT"] }, groqQuery: { type: "string" }, mutations: { type: "string", description: "JSON stringified Sanity mutation array." } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "google_workspace_agent",
            description: "Secure Google Workspace agent. Interacts with Gmail, Docs, and Sheets for enterprise productivity and correspondence.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["READ_GMAIL", "SEND_GMAIL", "READ_DOC", "READ_SHEET"] }, documentId: { type: "string" }, query: { type: "string" }, payload: { type: "string" } }, required: ["action"] } }
        }
    },
    {
        toolSpec: {
            name: "slack_collaboration_agent",
            description: "Collaboration agent for Slack. Dispatches messages to channels, reads channel history for summaries, objectives, and next steps.",
            inputSchema: { json: { type: "object", properties: { action: { type: "string", enum: ["READ_CHANNEL_HISTORY", "POST_MESSAGE"] }, channelId: { type: "string" }, message: { type: "string" } }, required: ["action", "channelId"] } }
        }
    }
];