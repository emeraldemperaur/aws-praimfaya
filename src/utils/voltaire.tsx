import { cssTransition } from 'react-toastify';
import novaIcon from '../assets/nova-icon.png';
import bedrockIcon from '../assets/bedrock-icon.png';
import mistralAIIcon from '../assets/mistralai-icon.png';
import cohereAIIcon from '../assets/cohereai-icon.png';
import stabilityAIIcon from '../assets/stability-ai-icon.png';
import deepseekIcon from '../assets/deepseek-icon.png';
import lumalabsIcon from '../assets/lumalabs-icon.png';
import twelvelabsIcon from '../assets/twelvelabs-icon.png';
import nvidiaIcon from '../assets/nvidia-icon.png';
import claudeIcon from '../assets/claude-icon.png';
import llamaIcon from '../assets/llama-icon.png';
import gemmaIcon from '../assets/google-icon.png';
import gptIcon from '../assets/gpt-oss-icon.png';
import cpuIcon from '../assets/cpu-icon.png';
import n8nIcon from '../assets/n8n-icon-logo.png';
import zapierIcon from '../assets/zapier-icon-logo.png';
import makeIcon from '../assets/make-icon-logo.png';
import pipedreamIcon from '../assets/pipedream-icon.png';
import miniMaxIcon from '../assets/minimax-icon.png';
import ai21labsIcon from '../assets/ai21-labs-icon.png';
import moonshotAIIcon from '../assets/moonshot-icon.png';
import qwenIcon from '../assets/qwen-icon.png';
import spaceXAIIcon from '../assets/grok-icon.png';
import writerIcon from '../assets/writer-icon.png';
import zaiIcon from '../assets/zai-icon.png';
import pollyIcon from '../assets/parrot-tts-icon.png';
import aiVoiceIcon from '../assets/voice-agent-icon.png';
import airtableIcon from '../assets/airtable-icon.png';
import snowflakeIcon from '../assets/snowflake-icon.png';
import airflowIcon from '../assets/airflow-icon.png';
import ripplingIcon from '../assets/rippling-icon.png';
import bambooHRIcon from '../assets/bamboo-hr-icon.png';
import zendeskIcon from '../assets/zendesk-icon.png';
import servicenowIcon from '../assets/servicenow-icon.png';
import pagerdutyIcon from '../assets/pagerduty-icon.png';
import githubIcon from '../assets/github-icon.png';
import gitlabIcon from '../assets/gitlab-icon.png';
import grafanaIcon from '../assets/grafana-icon.png';
import datadogIcon from '../assets/datadog-icon.png';
import salesforceIcon from '../assets/salesforce-icon.png';
import sapIcon from '../assets/sap-icon.png';
import dynamics365Icon from '../assets/dynamics365-icon.png';
import hubspotIcon from '../assets/hubspot-icon.png';
import linkedinIcon from '../assets/linkedin-icon.png';
import uipathIcon from '../assets/uipath-icon.png';
import slackIcon from '../assets/slack-icon.png';
import asanaIcon from '../assets/asana-icon.png';
import jiraIcon from '../assets/jira-icon.png';
import notionIcon from '../assets/notion-icon.png';
import contentfulIcon from '../assets/contentful-icon.png';
import sanityIcon from '../assets/sanity-icon.png';
import confluenceIcon from '../assets/confluence-icon.png';
import virtuosoIcon from '../assets/yardi-icon.png';
import butterflyMXIcon from '../assets/butterflymx-icon.png';
import bookingComIcon from '../assets/booking-com-icon.png';
import pricelineIcon from '../assets/priceline-icon.png';
import amadeusIcon from '../assets/amadeus-gds-icon.png';
import vrboIcon from '../assets/vrbo-icon.png';
import googleHomeIcon from '../assets/google-home-icon.png';
import appleHomeIcon from '../assets/apple-home-icon.png';
import alexaIcon from '../assets/alexa-icon.png';
import arduinoIcon from '../assets/arduino-icon.png';
import balenaCloudIcon from '../assets/balena-icon.png';
import byoMcpIcon from '../assets/byomcp-icon.png';
import formstackIcon from '../assets/formstack-icon.png';
import seleniumIcon from '../assets/selenium-icon.png';
import jotformIcon from '../assets/jotform-icon.png';
import extractPdfIcon from '../assets/pdf-icon.png';
import docGeneratorIcon from '../assets/doc-generator-icon.png';
import attachmentAnalyzerIcon from '../assets/file-scanner-icon.png';
import enterpriseImageIcon from '../assets/image-icon.png';

export const SuccessIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-regular fa-circle-check"></i></a>;
export const ErrorIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-radiation"></i>&nbsp;</a>;
export const InfoIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-info"></i>&nbsp;</a>;
export const WarningIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-exclamation"></i></a>;
export const CloseIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-xmark"></i></a>;
export const EyeSlashIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-regular fa-eye-slash"></i></a>;
export const EyeIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-regular fa-eye"></i></a>;


export const FluidToastAnimation = cssTransition({
  enter: 'praimfaya-toast-enter',
  exit: 'praimfaya-toast-exit',
});

export const contextCSSClass = {
    success: "toast-success",
    error: "toast-error",
    info: "toast-default",
    warning: "toast-default",
    default: "toast-default",
  };

export const AddAutomationWorkflowSVG = <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 512 512" 
            width="1em" 
            height="1em" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="32" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            aria-hidden="true"
            role="img"
          >
            <path d="M160 256 h96 V112 h96 M256 256 v144 h96" />
            
            <rect x="32" y="192" width="128" height="128" rx="16" />
            
            <rect x="352" y="48" width="128" height="128" rx="16" />
            
            <rect x="352" y="336" width="128" height="128" rx="16" />
          </svg>

export const AddVectorCollectionSVG = <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <defs>
              <mask id="microchip-mask">
                <rect width="24" height="24" fill="white" />
                <circle cx="18" cy="18" r="6.5" fill="black" />
              </mask>
              
              <mask id="plus-badge-mask">
                <rect width="24" height="24" fill="white" />
                <path 
                  d="M18 14.5v7m-3.5-3.5h7" 
                  stroke="black" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                />
              </mask>
            </defs>

            <g 
              mask="url(#microchip-mask)" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              fill="none"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              
              <path d="M8 4V1m4 3V1m4 3V1" />
              <path d="M4 8H1m3 4H1m3 4H1" />
              <path d="M8 20v3m4-3v3" />
              <path d="M20 8h3m-3 4h3" />

              <path d="M8.5 14.5L10.5 9.5L12.5 14.5M9.3 12.5h2.4M15 9.5v5" />
            </g>

            <circle 
              cx="18" 
              cy="18" 
              r="5.5" 
              fill="currentColor" 
              mask="url(#plus-badge-mask)" 
            />
          </svg>
  
export const inputStyle = (darkMode: boolean): React.CSSProperties => (  {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#f9fafb' : '#111827',
    fontFamily: 'inherit',
    boxSizing: 'border-box' 
  });

export const labelStyle = (darkMode: boolean): React.CSSProperties => ({
    display: 'block', marginBottom: '0.5rem', fontWeight: 500,
    fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151'
  });

export const getModelIcon = (identifier?: string | null): string => {
  if (!identifier) return cpuIcon;

  const id = identifier.toLowerCase();

  if (id.includes('n8n')) return n8nIcon;
  if (id.includes('zapier')) return zapierIcon;
  if (id === 'make' || id.includes('make.com')) return makeIcon;
  if (id.includes('pipedream')) return pipedreamIcon;

  if (id.includes('titan')) return bedrockIcon;
  if (id.includes('nova') || id.includes('amazon')) return novaIcon;

  if (id.includes('claude') || id.includes('anthropic')) return claudeIcon;
  if (id.includes('llama') || id.includes('meta')) return llamaIcon;
  if (id.includes('gpt') || id.includes('openai')) return gptIcon;
  if (id.includes('gemma') || id.includes('google')) return gemmaIcon;

  if (id.includes('deepseek')) return deepseekIcon;
  if (id.includes('mistral')) return mistralAIIcon;
  if (id.includes('cohere')) return cohereAIIcon;
  if (id.includes('qwen')) return qwenIcon;

  if (id.includes('ai21')) return ai21labsIcon;
  if (id.includes('minimax')) return miniMaxIcon;
  if (id.includes('moonshot') || id.includes('kimi')) return moonshotAIIcon;
  if (id.includes('xai') || id.includes('grok')) return spaceXAIIcon;
  if (id.includes('writer') || id.includes('palmyra')) return writerIcon;
  if (id.includes('zai') || id.includes('glm')) return zaiIcon;

  if (id.includes('twelvelabs') || id.includes('12labs')) return twelvelabsIcon;
  if (id.includes('luma')) return lumalabsIcon;
  if (id.includes('nvidia') || id.includes('nemotron')) return nvidiaIcon;
  if (id.includes('stability')) return stabilityAIIcon;

  if (id.includes('generate_audio') || id.includes('TTS Voice Synthesis Agent')) return pollyIcon;
  if (id.includes('generate_image') || id.includes('High Fidelity Image Generator')) return stabilityAIIcon;
  if (id.includes('generate_enterprise_image') || id.includes('Enterprise Image Generator')) return enterpriseImageIcon;
  if (id.includes('edit_image') || id.includes('High Fidelity Image Editor')) return novaIcon;
  if (id.includes('enterprise_voice_agent') || id.includes('Autonomous Voice Agent')) return aiVoiceIcon;
  if (id.includes('airtable_data_agent') || id.includes('Airtable Data Orchestrator')) return airtableIcon;
  if (id.includes('snowflake_data_agent') || id.includes('Snowflake Data Engineer')) return snowflakeIcon;
  if (id.includes('airflow_pipeline_agent') || id.includes('Airflow Pipeline Engineer')) return airflowIcon;
  if (id.includes('rippling_hr_agent') || id.includes('Rippling HR Admin Agent')) return ripplingIcon;
  if (id.includes('bamboohr_agent') || id.includes('BambooHR Liaison Agent')) return bambooHRIcon;
  if (id.includes('zendesk_support_agent') || id.includes('Zendesk Support Agent')) return zendeskIcon;
  if (id.includes('servicenow_itsm_agent') || id.includes('ServiceNow Automation Bot')) return servicenowIcon;
  if (id.includes('pagerduty_sre_agent') || id.includes('PagerDuty SRE Agent')) return pagerdutyIcon;
  if (id.includes('github_developer_agent') || id.includes('GitHub Operations Agent')) return githubIcon;
  if (id.includes('gitlab_developer_agent') || id.includes('GitLab DevSecOps Agent')) return gitlabIcon;
  if (id.includes('grafana_observability_agent') || id.includes('Grafana Observability Agent')) return grafanaIcon;
  if (id.includes('datadog_monitoring_agent') || id.includes('Datadog Telemetry Analyst')) return datadogIcon;
  if (id.includes('salesforce_crm_agent') || id.includes('Salesforce RevOps Agent')) return salesforceIcon;
  if (id.includes('sap_erp_agent') || id.includes('SAP ERP Integration Agent')) return sapIcon;
  if (id.includes('dynamics_365_agent') || id.includes('Dynamics 365 Automation Agent')) return dynamics365Icon;
  if (id.includes('hubspot_crm_agent') || id.includes('HubSpot RevOps Assistant')) return hubspotIcon;
  if (id.includes('linkedin_sales_agent') || id.includes('LinkedIn Sales Navigator')) return linkedinIcon;
  if (id.includes('uipath_orchestrator_agent') || id.includes('UiPath Orchestrator Agent')) return uipathIcon;
  if (id.includes('slack_collaboration_agent') || id.includes('Slack Communications Liaison')) return slackIcon;
  if (id.includes('asana_pm_agent') || id.includes('Asana Project Coordinator')) return asanaIcon;
  if (id.includes('jira_agile_agent') || id.includes('Jira Agile Project Manager')) return jiraIcon;
  if (id.includes('confluence_wiki_agent') || id.includes('Confluence Wiki Agent')) return confluenceIcon;
  if (id.includes('notion_workspace_agent') || id.includes('Notion Workspace Agent')) return notionIcon;
  if (id.includes('contentful_cms_agent') || id.includes('Contentful CMS Manager')) return contentfulIcon;
  if (id.includes('sanity_cms_agent') || id.includes('Sanity.io CMS Agent')) return sanityIcon;
  if (id.includes('yardi_virtuoso_agent') || id.includes('Yardi Virtuoso Agent')) return virtuosoIcon;
  if (id.includes('butterflymx_access_agent') || id.includes('ButterflyMX Access Agent')) return butterflyMXIcon;
  if (id.includes('booking_com_agent') || id.includes('Booking.com Partner Agent')) return bookingComIcon;
  if (id.includes('priceline_partner_agent') || id.includes('Priceline Travel Agent')) return pricelineIcon;
  if (id.includes('amadeus_gds_agent') || id.includes('Amadeus Travel GDS Agent')) return amadeusIcon;
  if (id.includes('vrbo_property_agent') || id.includes('Vrbo Property Agent')) return vrboIcon;
  if (id.includes('alphabet_home_agent') || id.includes('Google Smart Home Assistant')) return googleHomeIcon;
  if (id.includes('home_assistant_agent') || id.includes('HomeKit Home Assistant Agent')) return appleHomeIcon;
  if (id.includes('alexa_agent') || id.includes('Alexa Smart Home Agent')) return alexaIcon;
  if (id.includes('arduino_iot_agent') || id.includes('Arduino IoT Cloud Agent')) return arduinoIcon;
  if (id.includes('raspberry_pi_fleet_agent') || id.includes('Balena Cloud IoT Fleet Agent')) return balenaCloudIcon;
  if (id.includes('byo_mcp_agent') || id.includes('Bring Your Own MCP Agent')) return byoMcpIcon;
  if (id.includes('generate_document_agent') || id.includes('Document Generator Agent')) return docGeneratorIcon;
  if (id.includes('extract_pdf') || id.includes('PDF OCR Extractor')) return extractPdfIcon;
  if (id.includes('formstack_agile_agent') || id.includes('Formstack Onboarding Agent')) return formstackIcon;
  if (id.includes('jotform_agile_agent') || id.includes('Jotform Data Capture Agent')) return jotformIcon;
  if (id.includes('read_user_attachment') || id.includes('File Attachment Analyzer')) return attachmentAnalyzerIcon;
  if (id.includes('execute_vanguard_qa') || id.includes('Selenium Grid QA Agent')) return seleniumIcon;


  
  return cpuIcon;
};

/**
 * Converts specific video modality strings into simplified UI categories.
 * @param {string} modality - The backend modality string (e.g., 'TEXT_TO_VIDEO')
 * @returns {string} 'TEXT', 'IMAGE', or the original string fallback.
 */
export const getUiModality = (modality: string): string => {
  const map: Record<string, string> = {
    'TEXT_TO_VIDEO': 'TEXT TO VIDEO',
    'IMAGE_TO_VIDEO': 'IMAGE TO VIDEO',
  };

  return map[modality] || modality;
};

export const MODEL_FAMILY_DESCRIPTIONS: Record<string, string> = {
    'AMAZON': 'Exceptional speed-to-token ratios, massive context windows, and deeply integrated multimodal capabilities.',
    'ANTHROPIC': 'The gold standard for complex workflows, tool utilization, and extended reasoning.',
    'OPENAI': 'Enterprise grade GPT architecture with strict AWS procurement, regional data residency, and IAM boundaries.',
    'DEEPSEEK': 'Elite, cost-efficient open-source mixture-of-experts (MoE) reasoning directly within AWS secure perimeter. Fully supports rendering reasoning tokens alongside output tokens.',
    'META': 'Open-weight enterprise scaling. Incredibly resilient structural processing, highly optimized for Cross-Region Inference to bypass local data center capacity bottlenecks.',
    'GOOGLE': 'Brings Google’s premier open-weight family into the AWS cloud, giving developers the benefit of massive architectural optionality without vendor lock-in.',
    'MISTRAL': 'Strong mathematical, structural coding, and multilingual capabilities.',
    'COHERE': 'Built purposely for enterprise-grade Retrieval-Augmented Generation (RAG) and agentic multi-step tool deployment.',
    'NVIDIA': 'Hyper-focused on ultra-low latency execution and deep domain customization alignment.',
    'STABILITY_AI': 'Supports complex text-to-image, outpainting, search-and-replace, and structural editing.',
    'TWELVELABS': 'Processes visual, auditory, and textual information to generate contextually relevant text directly from video content.',
    'LUMA': 'Primarily harnessed for high-fidelity physical world modeling and advanced continuous generation.',
    'AI21': 'Enterprise-grade hybrid SSM-Transformer architecture specializing in highly efficient processing of ultra-long context windows and document structures.',
    'MINIMAX': 'Fast, flexible frontier models offering strong generalized capabilities and reasoning for rapid application deployment.',
    'MOONSHOT': 'Flagship models seamlessly merging native image understanding with robust tool calling and context capabilities.',
    'QWEN': 'Top-tier open-weight family excelling in complex multi-lingual processing, coding, and mathematical reasoning.',
    'WRITER': 'Purpose-built for enterprise workflows, offering massive 1 million token context windows, structural compliance, and precise tool delegation.',
    'XAI': 'Resilient, high-tier reasoning models equipped for extended agentic task loops, advanced coding, and robust data synthesis.',
    'ZAI': 'Strong all-rounder models balancing high-speed execution with dependable tool calling and cost-conscious performance.'
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  'STANDARD': 'An independent agent assistant that interacts directly with you to answer questions and complete tasks.',
  'SUPERVISOR': 'A manager agent that oversees complex projects by breaking them down and delegating steps to specialized Collaborators.',
  'COLLABORATOR': 'A highly-focused worker agent designed to complete specialized tasks assigned by a Supervisor.'
};

export const DATA_TYPES = ['String', 'Number', 'Float', 'Boolean', 'Array', 'Tuple', 'Date', 'DateTime', 'Object'];

export const getInitials = (name: string) => {
  const parts = name.split(/[\s._-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const isValidURL = (urlString?: string | null): boolean => {
  if (!urlString) return false;
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
};