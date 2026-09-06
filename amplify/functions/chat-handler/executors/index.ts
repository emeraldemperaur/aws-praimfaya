import { ToolExecutor } from './types';
import { executeRippling, executeBambooHR } from './hr-tools';
import { executeAudioGenerator, executeImageGenerator, executeLumaVideo } from './media-tools';
import { executePagerDuty, executeServiceNow, executeZendesk } from './ops-tools';
import { executeGitHub, executeGitLab } from './dev-tools';
import { executeAirflow, executeAirtable, executeSnowflake } from './data-tools';
import { executeAsana, executeConfluence, executeContentful, executeGoogleWorkspace, executeJira, executeNotion, executeSanityIO, executeSlack } from './productivity-tools';
import { executeDatadog, executeGrafana } from './sre-tools';
import { executeButterflyMX, executeYardi } from './property-tools';
import { executeDynamic365, executeHubSpotCRM, executeLinkedInSalesNavigator, executeSalesforceCRM, executeSAPERP } from './crm-tools';
import { executeUiPathOrchestrator } from './rpa-tools';
import { executeAmadeus, executeBooking, executePriceline, executeVrbo } from './travel-tools';
import { executeAmazonAlexa, executeGoogleHome, executeHomeAssistant } from './home-tools';
import { executeArduinoCloud, executeRaspberryPiFleet } from './iot-tools';
import { executeExtractPdf, executeGenerateDocument } from './document-tools';
import { executeApotheosisMCP, executeBYOMCP, executeMitoMCP } from './mcp-tools';
import { executeEnterpriseVoiceAgent } from './voice-tools';
import { executeFormstackAgent } from './formstack-tools';
import { executeAttachmentReader } from './attachment-tools';
import { executeJotformAgent } from './jotform-tools';
import { executeVanguardQA } from './qa-executor-tools';
import { executeLumaVideoPresentation } from './presentation-tools';


export const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
    'generate_audio': executeAudioGenerator,
    'generate_image': (ctx) => executeImageGenerator({ ...ctx, toolName: 'generate_image' }),
    'generate_enterprise_image': (ctx) => executeImageGenerator({ ...ctx, toolName: 'generate_enterprise_image' }),
    'edit_image': (ctx) => executeImageGenerator({ ...ctx, toolName: 'edit_image' }),
    'generate_luma_video': executeLumaVideo,
    'generate_document_agent': executeGenerateDocument,
    'read_user_attachment': executeAttachmentReader,
    'enterprise_voice_agent': executeEnterpriseVoiceAgent,
    'formstack_agile_agent': executeFormstackAgent,
    'jotform_agile_agent': executeJotformAgent,
    'rippling_hr_agent': executeRippling,
    'bamboohr_agent': executeBambooHR,
    'zendesk_support_agent': executeZendesk,
    'servicenow_itsm_agent': executeServiceNow,
    'pagerduty_sre_agent': executePagerDuty,
    'github_developer_agent': executeGitHub,
    'gitlab_developer_agent': executeGitLab,
    'airtable_data_agent': executeAirtable,
    'snowflake_data_agent': executeSnowflake,
    'airflow_pipeline_agent': executeAirflow,
    'jira_agile_agent': executeJira,
    'confluence_wiki_agent': executeConfluence,
    'notion_workspace_agent': executeNotion,
    'asana_pm_agent': executeAsana,
    'google_workspace_agent': executeGoogleWorkspace,
    'slack_collaboration_agent': executeSlack,
    'contentful_cms_agent': executeContentful,
    'sanity_cms_agent': executeSanityIO,
    'grafana_observability_agent': executeGrafana,
    'datadog_monitoring_agent': executeDatadog,
    'butterflymx_access_agent': executeButterflyMX,
    'yardi_virtuoso_agent': executeYardi,
    'salesforce_crm_agent': executeSalesforceCRM,
    'sap_erp_agent': executeSAPERP,
    'dynamics_365_agent': executeDynamic365,
    'hubspot_crm_agent': executeHubSpotCRM,
    'linkedin_sales_agent': executeLinkedInSalesNavigator,
    'uipath_rpa_agent': executeUiPathOrchestrator,
    'booking_com_agent': executeBooking,
    'priceline_partner_agent': executePriceline,
    'amadeus_gds_agent': executeAmadeus,
    'vrbo_property_agent': executeVrbo,
    'alphabet_home_agent': executeGoogleHome,
    'home_assistant_agent': executeHomeAssistant,
    'alexa_agent': executeAmazonAlexa,
    'arduino_iot_agent': executeArduinoCloud,
    'raspberry_pi_fleet_agent': executeRaspberryPiFleet,
    'mito_mcp_agent': executeMitoMCP,
    'apotheosis_mcp_agent': executeApotheosisMCP,
    'execute_qa_agent_task': executeVanguardQA,
    'generate_luma_video_presentation': executeLumaVideoPresentation

};