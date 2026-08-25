
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
    },
    // --- Enterprise Software Development ---
    {
        toolSpec: {
            name: "github_developer_agent",
            description: "Software developer agent for GitHub. Integrates with the GitHub REST API to securely review repositories, read files, commit code, and manage pull requests.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_REPO", "GET_FILE", "CREATE_OR_UPDATE_FILE", "CREATE_PULL_REQUEST", "MERGE_PULL_REQUEST"] }, 
                        owner: { type: "string", description: "Repository owner (user or organization)." }, 
                        repo: { type: "string", description: "Repository name." },
                        path: { type: "string", description: "File path in the repository." },
                        branch: { type: "string", description: "Target branch name." },
                        sourceBranch: { type: "string", description: "Source branch for Pull Requests." },
                        targetBranch: { type: "string", description: "Target branch for Pull Requests." },
                        commitMessage: { type: "string", description: "Message detailing the commit." },
                        fileContent: { type: "string", description: "Raw text content of the file to commit/push." },
                        pullRequestTitle: { type: "string", description: "Title of the Pull Request." },
                        pullRequestBody: { type: "string", description: "Description body of the Pull Request." },
                        pullRequestNumber: { type: "number", description: "PR number to merge." }
                    }, 
                    required: ["action", "owner", "repo"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "gitlab_developer_agent",
            description: "Software developer agent for GitLab. Integrates with GitLab Projects and Commits API to review repositories, read files, commit code, and manage merge requests.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_PROJECT", "GET_FILE", "COMMIT_FILE", "CREATE_MERGE_REQUEST", "ACCEPT_MERGE_REQUEST"] }, 
                        projectId: { type: "string", description: "Numeric project ID or URL-encoded namespace/project path." }, 
                        filePath: { type: "string", description: "File path in the repository." },
                        branch: { type: "string", description: "Target branch name." },
                        sourceBranch: { type: "string", description: "Source branch for Merge Requests." },
                        targetBranch: { type: "string", description: "Target branch for Merge Requests." },
                        commitMessage: { type: "string", description: "Message detailing the commit." },
                        fileContent: { type: "string", description: "Raw text content of the file to commit/push." },
                        fileAction: { type: "string", enum: ["create", "update", "delete"], description: "Action to take on the file during commit." },
                        mergeRequestTitle: { type: "string", description: "Title of the Merge Request." },
                        mergeRequestBody: { type: "string", description: "Description body of the Merge Request." },
                        mergeRequestIid: { type: "number", description: "Internal ID (IID) of the MR to accept." }
                    }, 
                    required: ["action", "projectId"] 
                } 
            }
        }
    },
    // --- Enterprise Site Reliability Engineering (SRE) ---
    {
        toolSpec: {
            name: "grafana_sre_agent",
            description: "SRE agent for Grafana Cloud. Inspects data sources, queries Prometheus metrics and Loki logs, and automatically provisions monitoring dashboards.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_DATA_SOURCES", "QUERY_METRICS", "QUERY_LOKI_LOGS", "CREATE_DASHBOARD"] }, 
                        dataSourceUid: { type: "string", description: "UID of the target Prometheus or Loki data source." },
                        query: { type: "string", description: "LogQL query for Loki or PromQL query for Prometheus." },
                        dashboardJson: { type: "string", description: "JSON stringified Grafana dashboard definition payload." },
                        timeRange: { type: "string", description: "Time range for queries (e.g., '1h', '6h', '24h'). Defaults to '1h'." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "datadog_sre_agent",
            description: "SRE agent for Datadog. Retrieves raw telemetry (metrics, logs) for downstream warehousing, inspects metrics, and creates Datadog dashboards.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["QUERY_LOGS", "QUERY_METRICS", "CREATE_DASHBOARD", "SEARCH_DASHBOARDS"] }, 
                        query: { type: "string", description: "Datadog log search query or metric query string." },
                        from: { type: "number", description: "Start time POSIX timestamp (seconds)." },
                        to: { type: "number", description: "End time POSIX timestamp (seconds)." },
                        dashboardJson: { type: "string", description: "JSON stringified Datadog dashboard definition." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    // --- Enterprise Property Management ---
    {
        toolSpec: {
            name: "butterflymx_access_agent",
            description: "Property access management agent for ButterflyMX. Interfaces with Access Points, Logs, Devices, Tenants, and Virtual Keys.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_BUILDINGS", "GET_TENANTS", "GET_ACCESS_LOGS", "OPEN_DOOR", "CREATE_VIRTUAL_KEY"] }, 
                        buildingId: { type: "string", description: "ButterflyMX Building ID." },
                        tenantId: { type: "string", description: "ButterflyMX Tenant ID." },
                        deviceId: { type: "string", description: "Device or Access Point ID for door release." },
                        virtualKeyData: { type: "string", description: "JSON stringified virtual key payload (start/end times, recipient)." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "yardi_rentcafe_agent",
            description: "Property management agent for Yardi RentCafe (via Virtuoso MCP). Handles tenant interactions, abstracts leases, audits ledgers, and processes maintenance.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        mcpToolName: { 
                            type: "string", 
                            enum: ["audit_ledger", "process_maintenance_request", "abstract_lease", "make_rent_payment", "review_lease"],
                            description: "The specific Yardi Virtuoso MCP tool to execute." 
                        }, 
                        mcpArguments: { 
                            type: "string", 
                            description: "JSON stringified arguments required for the specific Yardi tool." 
                        }
                    }, 
                    required: ["mcpToolName", "mcpArguments"] 
                } 
            }
        }
    },
    // --- Enterprise Core Business Operations ---
    {
        toolSpec: {
            name: "salesforce_crm_agent",
            description: "Salesforce CRM agent. Executes SOQL queries for forecasting, creates/updates records, and interacts with TaskRay for project management.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["SOQL_QUERY", "GET_RECORD", "CREATE_RECORD", "UPDATE_RECORD"] }, 
                        query: { type: "string", description: "Valid SOQL query string." },
                        objectName: { type: "string", description: "Salesforce SObject API name (e.g., Lead, Opportunity, TASKRAY__Project__c)." },
                        recordId: { type: "string", description: "Salesforce Record ID." },
                        recordData: { type: "string", description: "JSON stringified record payload." }
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
            name: "hubspot_crm_agent",
            description: "HubSpot CRM agent. securely retrieves and reviews Contacts, Deals, Custom Objects and Properties.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["SEARCH_OBJECTS", "GET_OBJECT", "CREATE_OBJECT", "UPDATE_OBJECT"] }, 
                        objectType: { type: "string", description: "contacts, deals, companies, or custom object ID." },
                        objectId: { type: "string", description: "HubSpot Object ID." },
                        searchQuery: { type: "string", description: "JSON stringified search filter payload." },
                        payload: { type: "string", description: "JSON stringified properties payload." }
                    }, 
                    required: ["action", "objectType"] 
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
            name: "uipath_rpa_agent",
            description: "UiPath Orchestrator agent. Manages unattended jobs, views robot status, and kicks off event-driven automations via OData.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_JOBS", "START_JOB", "STOP_JOB", "GET_QUEUE_ITEMS", "ADD_QUEUE_ITEM"] }, 
                        releaseKey: { type: "string", description: "Process Release Key needed to start a job." },
                        jobId: { type: "string", description: "Job ID." },
                        queueName: { type: "string", description: "Target UiPath Queue Name." },
                        payload: { type: "string", description: "JSON stringified input arguments or queue item data." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    // --- Enterprise Travel Booking & Reservation ---
    {
        toolSpec: {
            name: "booking_com_travel_agent",
            description: "Travel agent for Booking.com Demand API. Retrieves property/reservation details and guest feedback to contextualize inquiries and formulate personalized itineraries.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["SEARCH_PROPERTIES", "GET_PROPERTY_DETAILS", "GET_REVIEWS", "GET_ORDER_DETAILS"] }, 
                        query: { type: "string", description: "Search query or destination for properties." },
                        propertyId: { type: "string", description: "Booking.com Property ID." },
                        orderId: { type: "string", description: "Booking.com Order/Reservation ID." },
                        checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)." },
                        checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "priceline_travel_agent",
            description: "Travel agent for Priceline Partner Solutions API. Retrieves property details, reviews, and reservations to address guest inquiries and personalize recommendations.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["SEARCH_HOTELS", "GET_HOTEL_DETAILS", "GET_REVIEWS", "GET_RESERVATION"] }, 
                        destination: { type: "string", description: "Target destination for searches." },
                        hotelId: { type: "string", description: "Priceline Hotel ID." },
                        reservationId: { type: "string", description: "Priceline Reservation ID." }
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
            name: "mito_mcp_agent",
            description: "Full Stack Developer agent for Mito MCP Server. Generates full-stack components, uses frontend components based on a variant UI design system. Call action='LIST_TOOLS' to discover capabilities, then 'CALL_TOOL' to execute them.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["LIST_TOOLS", "CALL_TOOL"] }, 
                        mcpToolName: { type: "string", description: "The specific Mito MCP tool to execute (required for CALL_TOOL)." },
                        mcpArguments: { type: "string", description: "JSON stringified arguments required for the specific Mito tool." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "apotheosis_mcp_agent",
            description: "Full Stack Developer agent for Apotheosis MCP Server. Generates full-stack components, uses frontend components based on a strictly neumorphic UI design system. Call action='LIST_TOOLS' to discover capabilities, then 'CALL_TOOL' to execute them.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["LIST_TOOLS", "CALL_TOOL"] }, 
                        mcpToolName: { type: "string", description: "The specific Apotheosis MCP tool to execute (required for CALL_TOOL)." },
                        mcpArguments: { type: "string", description: "JSON stringified arguments required for the specific Apotheosis tool." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    // --- Enterprise Bring Your Own MCP (BYOMCP) ---
    {
        toolSpec: {
            name: "custom_mcp_agent",
            description: "Agent for the user's custom Bring Your Own MCP (BYOMCP) server. Connects to their proprietary infrastructure. Call action='LIST_TOOLS' to discover capabilities, then 'CALL_TOOL' to execute them.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["LIST_TOOLS", "CALL_TOOL"] }, 
                        mcpToolName: { type: "string", description: "The specific custom MCP tool to execute (required for CALL_TOOL)." },
                        mcpArguments: { type: "string", description: "JSON stringified arguments required for the specific tool." }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    // --- Enterprise Smart Home Management ---
    {
        toolSpec: {
            name: "google_home_agent",
            description: "Google Home Smart Home agent. EXPLICIT TRIGGER REQUIRED: Only use this tool if the user explicitly mentions 'Google Home' or 'Google Assistant'. Do not use for generic automation requests. Manages devices, states, and Structure/Room APIs.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_DEVICES", "CONTROL_DEVICE", "UPDATE_DEVICE", "GET_ROOMS", "MANAGE_ROOM"] }, 
                        deviceId: { type: "string", description: "Google Home Device ID." },
                        roomId: { type: "string", description: "Google Home Room/Structure ID." },
                        command: { type: "string", description: "Command payload (e.g., action.devices.commands.OnOff)." },
                        params: { type: "string", description: "JSON stringified command parameters (e.g., {\"on\": true})." },
                        roomAction: { type: "string", enum: ["add", "delete", "rename", "assign_device"] },
                        roomName: { type: "string" }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "apple_homekit_agent",
            description: "Apple HomeKit agent (via Home Assistant REST API). EXPLICIT TRIGGER REQUIRED: Only use this tool if the user explicitly mentions 'Apple HomeKit', 'HomeKit', or 'Siri'. Manages entities, states, areas, and services.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_DEVICES", "CONTROL_DEVICE", "GET_ROOMS", "MANAGE_ROOM"] }, 
                        entityId: { type: "string", description: "HomeKit/HA Entity ID (e.g., light.living_room)." },
                        domain: { type: "string", description: "Device domain (e.g., light, switch)." },
                        service: { type: "string", description: "Service to call (e.g., turn_on, turn_off)." },
                        serviceData: { type: "string", description: "JSON stringified service data payload." },
                        areaId: { type: "string", description: "HomeKit Area/Room ID." },
                        roomAction: { type: "string", enum: ["add", "delete", "rename", "assign_device"] },
                        roomName: { type: "string" }
                    }, 
                    required: ["action"] 
                } 
            }
        }
    },
    {
        toolSpec: {
            name: "amazon_alexa_smarthome_agent",
            description: "Amazon Alexa Smart Home agent. EXPLICIT TRIGGER REQUIRED: Only use this tool if the user explicitly mentions 'Alexa' or 'Echo'. Do not use for generic automation requests. Manages devices, state subscriptions, and groups/rooms.",
            inputSchema: { 
                json: { 
                    type: "object", 
                    properties: { 
                        action: { type: "string", enum: ["GET_DEVICES", "CONTROL_DEVICE", "GET_ROOMS", "MANAGE_ROOM"] }, 
                        endpointId: { type: "string", description: "Alexa Endpoint/Device ID." },
                        namespace: { type: "string", description: "Alexa interface namespace (e.g., Alexa.PowerController)." },
                        name: { type: "string", description: "Command name (e.g., TurnOn, TurnOff)." },
                        payload: { type: "string", description: "JSON stringified command payload." },
                        groupId: { type: "string", description: "Alexa Group/Room ID." },
                        roomAction: { type: "string", enum: ["add", "delete", "rename", "assign_device"] },
                        roomName: { type: "string" }
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