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

export const getModelIcon = (modelName?: string | null): string => {
  if (!modelName) return cpuIcon;

  const normalizedName = modelName.toLowerCase();

  // 1. Check for specific Amazon sub-brands FIRST
  if (normalizedName.includes('titan') || normalizedName.includes('amazon.titan-embed-text-v2:0')) {
    return bedrockIcon;
  }

  // 2. Now check for Nova or generic Amazon fallback
  if (normalizedName.includes('nova') || normalizedName.includes('amazon')) {
    return novaIcon;
  }

  // 3. Continue with the rest of the providers...
  if (normalizedName.includes('mistral') || normalizedName.includes('mistral.large') || normalizedName.includes('mistralai')) {
    return mistralAIIcon;
  }

  if (normalizedName.includes('cohere') || normalizedName.includes('cohere.ai')) {
    return cohereAIIcon;
  }

  if (normalizedName.includes('stability') || normalizedName.includes('stability.ai')) {
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