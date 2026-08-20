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

  const normalizedName = identifier.toLowerCase();

  if (normalizedName.includes('n8n')) {
    return n8nIcon;
  }
  if (normalizedName.includes('zapier')) {
    return zapierIcon;
  }
  if (normalizedName === 'make' || normalizedName.includes('make.com')) {
   
    return makeIcon;
  }
  if (normalizedName.includes('pipedream')) {
    return pipedreamIcon;
  }

  if (normalizedName.includes('titan') || normalizedName.includes('amazon.titan-embed-text-v2:0')) {
    return bedrockIcon;
  }

  if (normalizedName.includes('nova') || normalizedName.includes('amazon')) {
    return novaIcon;
  }

  if (normalizedName.includes('mistral') || normalizedName.includes('mistral.large') || normalizedName.includes('mistralai')) {
    return mistralAIIcon;
  }

  if (normalizedName.includes('cohere') || normalizedName.includes('cohere.ai')) {
    return cohereAIIcon;
  }

  if (normalizedName.includes('stability') || normalizedName.includes('stability.ai') || normalizedName.includes('stability_ai')) {
    return stabilityAIIcon;
  }

  if (normalizedName.includes('deepseek') || normalizedName.includes('deepseek.ai')) {
    return deepseekIcon;
  }

  if (normalizedName.includes('lumalabs') || normalizedName.includes('luma labs') || normalizedName.includes('luma')) {
    return lumalabsIcon;
  }

  if (normalizedName.includes('twelvelabs') || normalizedName.includes('12labs')) {
    return twelvelabsIcon;
  }

  if (normalizedName.includes('nvidia') || normalizedName.includes('nemotron')) {
    return nvidiaIcon;
  }
  
  if (normalizedName.includes('claude') || normalizedName.includes('anthropic')) {
    return claudeIcon;
  }
  
  if (normalizedName.includes('llama') || normalizedName.includes('meta')) {
    return llamaIcon;
  }
  
  if (normalizedName.includes('gemma') || normalizedName.includes('google')) {
    return gemmaIcon;
  }
  
  if (normalizedName.includes('gpt') || normalizedName.includes('openai')) {
    return gptIcon;
  }

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
  'LUMA': 'Primarily harnessed for high-fidelity physical world modeling and advanced continuous generation.'
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