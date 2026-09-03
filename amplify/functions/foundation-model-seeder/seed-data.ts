export const SEED_MODELS = [
    // Amazon Nova
    { 
      name: 'Amazon Nova Micro', apiIdentifier: 'amazon.nova-micro-v1:0', provider: 'AMAZON', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Highly efficient text model ideal for rapid, low-latency tasks and simple instruction following.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Amazon Nova Lite', apiIdentifier: 'amazon.nova-lite-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Balanced multimodal model for cost-effective document, image, and text analysis.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'Amazon Nova Pro', apiIdentifier: 'amazon.nova-pro-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Advanced multimodal reasoning for complex enterprise workflows and deep data synthesis.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Amazon Nova Premier', apiIdentifier: 'amazon.nova-premier-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Amazon flagship model offering top-tier reasoning, accuracy, and multimodal comprehension.', caliber: 'ULTRA_PERFORMANCE', region: 'GLOBAL' 
    },
    
    // Cross-Region Nova
    { 
      name: 'Amazon Nova Pro (Global)', apiIdentifier: 'global.amazon.nova-pro-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Advanced multimodal reasoning with global AWS routing for optimized latency and maximum uptime.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Amazon Nova Pro (US)', apiIdentifier: 'us.amazon.nova-pro-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Advanced multimodal reasoning with guaranteed US data residency and routing.', caliber: 'HIGH_PERFORMANCE', region: 'US' 
    },
    { 
      name: 'Amazon Nova Pro (EU)', apiIdentifier: 'eu.amazon.nova-pro-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Advanced multimodal reasoning isolated to European endpoints for strict GDPR compliance.', caliber: 'HIGH_PERFORMANCE', region: 'EU' 
    },
    { 
      name: 'Amazon Nova Pro (APAC)', apiIdentifier: 'apac.amazon.nova-pro-v1:0', provider: 'AMAZON', modality: 'MULTIMODAL', contextWindowTokens: 300000, isActive: true,
      description: 'Advanced multimodal reasoning optimized for Asia-Pacific data residency.', caliber: 'HIGH_PERFORMANCE', region: 'APAC' 
    },

    // AI21 Labs
    { 
      name: 'AI21 Jamba 1.5 Mini', apiIdentifier: 'ai21.jamba-1-5-mini-v1:0', provider: 'AI21', modality: 'TEXT', contextWindowTokens: 256000, isActive: true,
      description: 'Lightweight hybrid SSM-Transformer model heavily optimized for low-latency enterprise tasks across massive context windows.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'AI21 Jamba 1.5 Large', apiIdentifier: 'ai21.jamba-1-5-large-v1:0', provider: 'AI21', modality: 'TEXT', contextWindowTokens: 256000, isActive: true,
      description: 'Powerful long-context hybrid model excelling at paired document analysis, complex reasoning, and compliance checking.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'AI21 Jamba 1.5 Large (US)', apiIdentifier: 'us.ai21.jamba-1-5-large-v1:0', provider: 'AI21', modality: 'TEXT', contextWindowTokens: 256000, isActive: true,
      description: 'Powerful long-context hybrid model with strict US data residency.', caliber: 'HIGH_PERFORMANCE', region: 'US' 
    },

    // Anthropic Claude 5
    { 
      name: 'Claude 5 Haiku', apiIdentifier: 'anthropic.claude-5-haiku-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'Lightning-fast multimodal model for near-instant responses on lightweight agentic tasks.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Claude 5 Sonnet', apiIdentifier: 'anthropic.claude-5-sonnet-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'The enterprise standard for intelligence, advanced coding, and complex agentic routing.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Claude 5 Opus', apiIdentifier: 'anthropic.claude-5-opus-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'High-tier legacy reasoning model serving as the secure fallback for constrained or high-risk domains.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Claude 5 Fable', apiIdentifier: 'anthropic.claude-5-fable-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'Mythos-Class flagship model engineered for massive, multi-day autonomous task planning and deep agentic delegation.', caliber: 'ULTRA_PERFORMANCE', region: 'GLOBAL' 
    },
    
    // Cross-Region Claude 5
    { 
      name: 'Claude 5 Sonnet (Global)', apiIdentifier: 'global.anthropic.claude-5-sonnet-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'High-performance coding and reasoning automatically routed across AWS regions to bypass throttling.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Claude 5 Sonnet (US)', apiIdentifier: 'us.anthropic.claude-5-sonnet-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'High-performance coding and reasoning with strict US data residency.', caliber: 'HIGH_PERFORMANCE', region: 'US' 
    },
    { 
      name: 'Claude 5 Sonnet (EU)', apiIdentifier: 'eu.anthropic.claude-5-sonnet-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'High-performance coding and reasoning with strict EU GDPR compliance.', caliber: 'HIGH_PERFORMANCE', region: 'EU' 
    },
    { 
      name: 'Claude 5 Sonnet (APAC)', apiIdentifier: 'apac.anthropic.claude-5-sonnet-20260415-v1:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'High-performance coding and reasoning localized for Asia-Pacific data residency.', caliber: 'HIGH_PERFORMANCE', region: 'APAC' 
    },

    // Anthropic Claude 3.5 (Legacy/Fallback)
    { 
      name: 'Claude 3.5 Sonnet', apiIdentifier: 'anthropic.claude-3-5-sonnet-20241022-v2:0', provider: 'ANTHROPIC', modality: 'MULTIMODAL', contextWindowTokens: 200000, isActive: true,
      description: 'Legacy powerhouse model providing excellent coding and multimodal capabilities.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },

    // DeepSeek
    { 
      name: 'DeepSeek R1', apiIdentifier: 'deepseek.deepseek-r1', provider: 'DEEPSEEK', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Advanced open-weights Chain-of-Thought reasoning model generating highly structured logical output.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'DeepSeek V3.2', apiIdentifier: 'deepseek.deepseek-v3-2', provider: 'DEEPSEEK', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Extremely cost-efficient open model offering top-tier reasoning and coding capabilities.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'DeepSeek V3.2 (Global)', apiIdentifier: 'global.deepseek.deepseek-v3-2', provider: 'DEEPSEEK', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Top-tier open-source coding and reasoning deployed across a global failure-resistant AWS network.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'DeepSeek V3.2 (US)', apiIdentifier: 'us.deepseek.deepseek-v3-2', provider: 'DEEPSEEK', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Top-tier open-source coding and reasoning with US data residency.', caliber: 'HIGH_PERFORMANCE', region: 'US' 
    },
    { 
      name: 'DeepSeek V3.2 (EU)', apiIdentifier: 'eu.deepseek.deepseek-v3-2', provider: 'DEEPSEEK', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Top-tier open-source coding and reasoning with EU GDPR compliance.', caliber: 'HIGH_PERFORMANCE', region: 'EU' 
    },
    { 
      name: 'DeepSeek V3.2 (APAC)', apiIdentifier: 'apac.deepseek.deepseek-v3-2', provider: 'DEEPSEEK', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Top-tier open-source coding and reasoning with APAC data residency.', caliber: 'HIGH_PERFORMANCE', region: 'APAC' 
    },

    // Google Gemma 4
    { 
      name: 'Google Gemma 4 E2B', apiIdentifier: 'google.gemma-4-e2b', provider: 'GOOGLE', modality: 'TEXT', contextWindowTokens: 8192, isActive: true,
      description: 'Extremely lightweight model optimized for edge and rapid small-scale tasks.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Google Gemma 4 26B', apiIdentifier: 'google.gemma-4-26b-a4b', provider: 'GOOGLE', modality: 'TEXT', contextWindowTokens: 32000, isActive: true,
      description: 'Capable mid-sized model for general text processing and instruction following.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'Google Gemma 4 31B', apiIdentifier: 'google.gemma-4-31b', provider: 'GOOGLE', modality: 'TEXT', contextWindowTokens: 32000, isActive: true,
      description: 'Google most capable open-weights model with enhanced reasoning and context retention.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },

    // Meta Llama 4
    { 
      name: 'Meta Llama 4 Scout 17B', apiIdentifier: 'meta.llama4-scout-17b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Lightweight, highly efficient open-weights model for fast text generation.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Meta Llama 4 Maverick 17B', apiIdentifier: 'meta.llama4-maverick-17b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Highly optimized compact model for standard enterprise tasks.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'Meta Llama 3.1 70B', apiIdentifier: 'meta.llama3-1-70b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Well-rounded open-weights model suitable for a wide range of NLP tasks.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'Meta Llama 3.1 405B', apiIdentifier: 'meta.llama3-1-405b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Massive frontier-class open model with state-of-the-art general knowledge and reasoning.', caliber: 'ULTRA_PERFORMANCE', region: 'GLOBAL' 
    },
    
    // Cross-Region Llama 4
    { 
      name: 'Meta Llama 4 Scout 17B (Global)', apiIdentifier: 'global.meta.llama4-scout-17b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Fast, efficient open-weights text generation dynamically routed globally for extreme resilience.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Meta Llama 4 Scout 17B (US)', apiIdentifier: 'us.meta.llama4-scout-17b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Fast, efficient open-weights text generation with US data residency.', caliber: 'FAST', region: 'US' 
    },
    { 
      name: 'Meta Llama 4 Scout 17B (EU)', apiIdentifier: 'eu.meta.llama4-scout-17b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Fast, efficient open-weights text generation with EU GDPR compliance.', caliber: 'FAST', region: 'EU' 
    },
    { 
      name: 'Meta Llama 4 Scout 17B (APAC)', apiIdentifier: 'apac.meta.llama4-scout-17b-instruct-v1:0', provider: 'META', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Fast, efficient open-weights text generation with APAC data residency.', caliber: 'FAST', region: 'APAC' 
    },

    // MiniMax
    { 
      name: 'MiniMax A1', apiIdentifier: 'minimax.minimax-a1-v1:0', provider: 'MINIMAX', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Capable foundational model built for rapid instructional alignment and enterprise utility.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'MiniMax M2.1', apiIdentifier: 'minimax.minimax-m2-1-v1:0', provider: 'MINIMAX', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'High-utility model specializing in generalized reasoning and complex multi-lingual processing.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },

    // Mistral
    { 
      name: 'Mistral Voxtral Mini 3B', apiIdentifier: 'mistral.voxtral-mini-3b-2507', provider: 'MISTRAL', modality: 'TEXT', contextWindowTokens: 32000, isActive: true,
      description: 'Ultra-fast small model designed for low-latency, specialized text tasks.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Mistral Large 3', apiIdentifier: 'mistral.mistral-large-3-v1:0', provider: 'MISTRAL', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Top-tier European model offering exceptional multilingual reasoning and code generation.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Mistral Large 3 (EU)', apiIdentifier: 'eu.mistral.mistral-large-3-v1:0', provider: 'MISTRAL', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Exceptional multilingual reasoning guaranteed to remain within EU data boundaries.', caliber: 'HIGH_PERFORMANCE', region: 'EU' 
    },

    // Moonshot AI
    { 
      name: 'Moonshot Kimi K2.5', apiIdentifier: 'moonshotai.kimi-k2-5-v1:0', provider: 'MOONSHOT', modality: 'MULTIMODAL', contextWindowTokens: 128000, isActive: true,
      description: 'Open-weight flagship model coupling native image understanding with robust tool calling.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Moonshot Kimi K2.5 (US)', apiIdentifier: 'us.moonshotai.kimi-k2-5-v1:0', provider: 'MOONSHOT', modality: 'MULTIMODAL', contextWindowTokens: 128000, isActive: true,
      description: 'Open-weight flagship model bringing native image understanding to US endpoints.', caliber: 'HIGH_PERFORMANCE', region: 'US' 
    },

    // Cohere
    { 
      name: 'Cohere Command R', apiIdentifier: 'cohere.command-r-v1:0', provider: 'COHERE', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Enterprise-focused model optimized for Retrieval-Augmented Generation (RAG) and tool use.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'Cohere Command R+', apiIdentifier: 'cohere.command-r-plus-v1:0', provider: 'COHERE', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Flagship enterprise model with advanced RAG, multi-step tool use, and deep context analysis.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },

    // NVIDIA
    { 
      name: 'NVIDIA Nemotron Nano 12B', apiIdentifier: 'nvidia.nemotron-nano-12b-v2-vl-bf16', provider: 'NVIDIA', modality: 'MULTIMODAL', contextWindowTokens: 32000, isActive: true,
      description: 'Highly efficient multimodal model for rapid visual and text tasks.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'NVIDIA Nemotron 3 Super 120B', apiIdentifier: 'nvidia.nemotron-3-super-120b', provider: 'NVIDIA', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Massive enterprise model optimized for complex NLP, synthetic data generation, and coding.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },

    // Qwen
    { 
      name: 'Qwen3 235B', apiIdentifier: 'qwen.qwen3-235b-a22b-2507-v1:0', provider: 'QWEN', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Heavyweight open-source foundation model excelling in coding and mathematics.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Qwen3 235B (US)', apiIdentifier: 'us.qwen.qwen3-235b-a22b-2507-v1:0', provider: 'QWEN', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Heavyweight open-source foundation model anchored to US regions.', caliber: 'HIGH_PERFORMANCE', region: 'US' 
    },

    // TwelveLabs
    { 
      name: 'TwelveLabs Pegasus 1.2', apiIdentifier: 'twelvelabs.pegasus-1-2-v1:0', provider: 'TWELVELABS', modality: 'MULTIMODAL', contextWindowTokens: 8192, isActive: true,
      description: 'Specialized state-of-the-art video-language model for deep video understanding and retrieval.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },

    // Amazon Titan
    { 
      name: 'Amazon Titan Text Express', apiIdentifier: 'amazon.titan-text-express-v1', provider: 'AMAZON', modality: 'TEXT', contextWindowTokens: 8000, isActive: true,
      description: 'Cost-effective, rapid text model for summarization and basic natural language tasks.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Amazon Titan Text Premier', apiIdentifier: 'amazon.titan-text-premier-v1:0', provider: 'AMAZON', modality: 'TEXT', contextWindowTokens: 32000, isActive: true,
      description: 'Advanced text model tailored for enterprise RAG and complex document processing.', caliber: 'MODERATE', region: 'GLOBAL' 
    },

    // Writer
    { 
      name: 'Writer Palmyra X4', apiIdentifier: 'writer.palmyra-x4-v1:0', provider: 'WRITER', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Robust enterprise tool caller built with a 128K context window and multi-step reasoning capabilities.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Writer Palmyra X5', apiIdentifier: 'writer.palmyra-x5-v1:0', provider: 'WRITER', modality: 'TEXT', contextWindowTokens: 1000000, isActive: true,
      description: 'Ultra-performance enterprise agent model featuring a massive 1 million token context window.', caliber: 'ULTRA_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'Writer Palmyra Vision 7B', apiIdentifier: 'writer.palmyra-vision-7b-v1:0', provider: 'WRITER', modality: 'MULTIMODAL', contextWindowTokens: 128000, isActive: true,
      description: 'High-speed multimodal agent capable of interpreting visual data for enterprise workflows.', caliber: 'MODERATE', region: 'GLOBAL' 
    },

    // xAI
    { 
      name: 'xAI Grok 4.3', apiIdentifier: 'xai.grok-4-3-v1:0', provider: 'XAI', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'A powerful, unfiltered reasoning engine heavily optimized for enterprise workloads.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'xAI Grok 4.6', apiIdentifier: 'xai.grok-4-6-v1:0', provider: 'XAI', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Flagship xAI model built to tackle highly complex coding scenarios and multi-agent workflows.', caliber: 'ULTRA_PERFORMANCE', region: 'GLOBAL' 
    },
    { 
      name: 'xAI Grok 4.6 (US)', apiIdentifier: 'us.xai.grok-4-6-v1:0', provider: 'XAI', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Flagship xAI coding model with strict US data residency.', caliber: 'ULTRA_PERFORMANCE', region: 'US' 
    },

    // Z AI (Zhipu)
    { 
      name: 'Zhipu GLM 4.7 Flash', apiIdentifier: 'zai.glm-4-7-flash-v1:0', provider: 'ZAI', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Cost-conscious text model ensuring maximum processing speed for simple text generation.', caliber: 'FAST', region: 'GLOBAL' 
    },
    { 
      name: 'Zhipu GLM 4.7', apiIdentifier: 'zai.glm-4-7-v1:0', provider: 'ZAI', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Solid, reliable all-around text model bridging the gap between cost efficiency and capability.', caliber: 'MODERATE', region: 'GLOBAL' 
    },
    { 
      name: 'Zhipu GLM 5', apiIdentifier: 'zai.glm-5-v1:0', provider: 'ZAI', modality: 'TEXT', contextWindowTokens: 128000, isActive: true,
      description: 'Flagship reasoning model for demanding multi-step enterprise workflows.', caliber: 'HIGH_PERFORMANCE', region: 'GLOBAL' 
    }
];