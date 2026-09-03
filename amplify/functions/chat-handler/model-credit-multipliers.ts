export const MODEL_CREDIT_MULTIPLIERS: Record<string, number> = { 
    // Amazon Nova
    "amazon.nova-micro-v1:0": 1,        // Raw Cost: ~$0.14 -> 150% Profit (Minimum 1 unit)
    "amazon.nova-lite-v1:0": 1,         // Raw Cost: ~$0.24 -> 150% Profit (Minimum 1 unit)
    "amazon.nova-pro-v1:0": 8,          // Raw Cost: ~$3.20 -> 150% Profit
    "amazon.nova-premier-v1:0": 38,     // Raw Cost: ~$15.00 -> 150% Profit
    "global.amazon.nova-pro-v1:0": 8,   // AWS Global Routing -> 150% Profit
    "us.amazon.nova-pro-v1:0": 8,
    "eu.amazon.nova-pro-v1:0": 8,
    "apac.amazon.nova-pro-v1:0": 8,

    // Anthropic Claude 5
    "anthropic.claude-5-haiku-20260415-v1:0": 4,   // Raw Cost: ~$1.25 -> 150% Profit
    "anthropic.claude-5-sonnet-20260415-v1:0": 38, // Raw Cost: ~$15.00 -> 150% Profit
    "anthropic.claude-5-opus-20260415-v1:0": 75,   // Raw Cost: ~$30.00 -> 150% Profit 
    "anthropic.claude-5-fable-20260415-v1:0": 125, // Raw Cost: ~$50.00 -> 150% Profit 
    "global.anthropic.claude-5-sonnet-20260415-v1:0": 38, // AWS Global Routing -> 150% Profit
    "us.anthropic.claude-5-sonnet-20260415-v1:0": 38,
    "eu.anthropic.claude-5-sonnet-20260415-v1:0": 38,
    "apac.anthropic.claude-5-sonnet-20260415-v1:0": 38,
    
    // Anthropic Claude 3.5 (Legacy/Fallback)
    "anthropic.claude-3-5-sonnet-20241022-v2:0": 38,

    // AI21 Labs
    "ai21.jamba-1-5-mini-v1:0": 1,
    "us.ai21.jamba-1-5-mini-v1:0": 1,
    "eu.ai21.jamba-1-5-mini-v1:0": 1,
    "ai21.jamba-1-5-large-v1:0": 5,
    "us.ai21.jamba-1-5-large-v1:0": 5,
    "ai21.j2-ultra-v1": 38,

    // Cohere
    "cohere.command-r-v1:0": 4,         // Raw Cost: ~$1.50 -> 150% Profit
    "cohere.command-r-plus-v1:0": 38,   // Raw Cost: ~$15.00 -> 150% Profit

    // DeepSeek
    "deepseek.deepseek-r1": 7,          // Intensive reasoning overhead -> 150% Profit
    "deepseek.deepseek-v3-2": 5,        // Raw Cost: ~$1.85 -> 150% Profit
    "global.deepseek.deepseek-v3-2": 5, // AWS Global Routing -> 150% Profit
    "us.deepseek.deepseek-v3-2": 5,
    "eu.deepseek.deepseek-v3-2": 5,
    "apac.deepseek.deepseek-v3-2": 5,

    // Google Gemma
    "google.gemma-4-e2b": 1,            // Raw Cost: ~$0.08 -> 150% Profit (Minimum 1 unit)
    "google.gemma-4-26b-a4b": 1,        // Raw Cost: ~$0.29 -> 150% Profit (Minimum 1 unit)
    "google.gemma-4-31b": 1,            // Raw Cost: ~$0.38 -> 150% Profit (Minimum 1 unit)

    // Meta Llama 4 & 3.1
    "meta.llama4-scout-17b-instruct-v1:0": 1,     // Raw Cost: ~$0.17 -> 150% Profit (Minimum 1 unit)
    "meta.llama4-maverick-17b-instruct-v1:0": 2,  // Raw Cost: ~$0.80 -> 150% Profit
    "meta.llama3-1-70b-instruct-v1:0": 2,         // Raw Cost: ~$0.72 -> 150% Profit
    "meta.llama3-1-405b-instruct-v1:0": 6,        // Raw Cost: ~$2.13 -> 150% Profit
    "global.meta.llama4-scout-17b-instruct-v1:0": 1, // AWS Global Routing -> 150% Profit
    "us.meta.llama4-scout-17b-instruct-v1:0": 1,
    "eu.meta.llama4-scout-17b-instruct-v1:0": 1,
    "apac.meta.llama4-scout-17b-instruct-v1:0": 1,

    // MiniMax
    "minimax.minimax-a1-v1:0": 2,
    "us.minimax.minimax-a1-v1:0": 2,
    "minimax.minimax-m2-1-v1:0": 4,
    "us.minimax.minimax-m2-1-v1:0": 4,

    // Mistral
    "mistral.voxtral-mini-3b-2507": 1,  // Raw Cost: ~$0.20 -> 150% Profit (Minimum 1 unit)
    "mistral.mistral-large-3-v1:0": 15, // Raw Cost: ~$6.00 -> 150% Profit
    "eu.mistral.mistral-large-3-v1:0": 15,

    // Moonshot AI
    "moonshotai.kimi-k2-v1:0": 6,
    "moonshotai.kimi-k2-5-v1:0": 8,
    "us.moonshotai.kimi-k2-5-v1:0": 8,
    "apac.moonshotai.kimi-k2-5-v1:0": 8,

    // NVIDIA
    "nvidia.nemotron-nano-12b-v2-vl-bf16": 2, // Raw Cost: ~$0.50 -> 150% Profit
    "nvidia.nemotron-3-super-120b": 8,        // Raw Cost: ~$3.00 -> 150% Profit

    // Qwen
    "qwen.qwen3-instruct-v1:0": 2,
    "qwen.qwen3-235b-a22b-2507-v1:0": 6,
    "us.qwen.qwen3-235b-a22b-2507-v1:0": 6,
    "apac.qwen.qwen3-235b-a22b-2507-v1:0": 6,

    // TwelveLabs
    "twelvelabs.pegasus-1-2-v1:0": 19,  // Raw Cost: ~$7.50 -> 150% Profit

    // Writer
    "writer.palmyra-vision-7b-v1:0": 3,
    "us.writer.palmyra-vision-7b-v1:0": 3,
    "writer.palmyra-x4-v1:0": 8,
    "us.writer.palmyra-x4-v1:0": 8,
    "writer.palmyra-x5-v1:0": 35,
    "us.writer.palmyra-x5-v1:0": 35,

    // xAI
    "xai.grok-4-3-v1:0": 15,
    "us.xai.grok-4-3-v1:0": 15,
    "xai.grok-4-6-v1:0": 30,
    "us.xai.grok-4-6-v1:0": 30,

    // Z AI (Zhipu)
    "zai.glm-4-7-flash-v1:0": 1,
    "zai.glm-4-7-v1:0": 3,
    "us.zai.glm-4-7-v1:0": 3,
    "zai.glm-5-v1:0": 12,
    "us.zai.glm-5-v1:0": 12,

    // Amazon Titan
    "amazon.titan-text-express-v1": 1,  // Raw Cost: ~$0.30 -> 150% Profit (Minimum 1 unit)
    "amazon.titan-text-premier-v1:0": 3 // Raw Cost: ~$1.20 -> 150% Profit
};