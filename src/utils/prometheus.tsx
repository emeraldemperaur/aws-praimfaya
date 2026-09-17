export type ModelAvailability = 'STANDARD_ONLY' | 'ALL_AGENTS';
export type CostImpact = 'LOW_COMPUTE' | 'MEDIUM_COMPUTE' | 'HIGH_COMPUTE' | 'ULTRA_COMPUTE';

export interface VanguardToolTemplate {
    toolName: string;
    publicName: string;
    systemPrompt: string;
    userPrompts: { promptName: string; userPrompt: string }[];
    modelAvailability: ModelAvailability;
    costImpact: CostImpact;
}

export const NATIVE_TOOLS_TEMPLATES: VanguardToolTemplate[] = [
    {
        toolName: "generate_image",
        publicName: "High Fidelity Image Generator",
        systemPrompt: "You are an expert stable-diffusion prompt engineer. Translate user requests into a comma-separated list of highly descriptive visual keywords. Explicitly define style, lighting, camera angle, and medium (e.g., 'digital art, photorealistic, cinematic lighting, 8k, volumetric rays').",
        userPrompts: [
            {
                promptName: "Generate Creative Ad",
                userPrompt: "Conceptualize and generate a high-converting social media ad image for a {{product_description_e.g._premium_cyberpunk_energy_drink}}. Apply {{lighting_style_e.g._dramatic_studio_lighting}} and a {{art_style_e.g._photorealistic_8k}} style."
            },
            {
                promptName: "Create Storyboard",
                userPrompt: "Generate a sequence of storyboard keyframes depicting a {{scene_description_e.g._futuristic_autonomous_vehicle_navigating_a_neon_city}}. Focus on dynamic camera angles and {{lighting_mood_e.g._moody_neon_lighting}}."
            },
            {
                promptName: "Conceptualize Art",
                userPrompt: "Create a highly detailed concept art piece of a {{subject_e.g._biopunk_city_integrated_with_ancient_ruins}}, focusing on {{specific_details_e.g._volumetric_rays}} and a {{aesthetic_e.g._lush_overgrown}} aesthetic."
            },
            {
                promptName: "Editorial Illustration",
                userPrompt: "Design a clean, modern editorial illustration representing {{topic_e.g._the_integration_of_AI_in_global_finance}}, using a {{style_e.g._minimalist_corporate}} style with striking visual metaphors."
            },
            {
                promptName: "Rapid Prototyping",
                userPrompt: "Generate a photorealistic industrial design prototype of a {{product_e.g._next-generation_smart_wearable_device}}, resting on a {{background_setting_e.g._sleek_marble_desk}} with soft ambient lighting."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "edit_image",
        publicName: "High Fidelity Image Editor",
        systemPrompt: "You are a precise image editing assistant. Formulate clear spatial and contextual instructions for Amazon Nova Canvas. You MUST extract the `s3Uri` from the [System Context] of the user's uploaded attachment and map it to the requested taskType (INPAINTING, OUTPAINTING, BACKGROUND_REMOVAL).",
        userPrompts: [
            {
                promptName: "Swap Image Background",
                userPrompt: "Analyze the attached image at {{s3_uri}}. Execute a BACKGROUND_REMOVAL operation, then use INPAINTING to place the main subject onto a {{new_background_description_e.g._sunlit_tropical_beach}}."
            },
            {
                promptName: "Remove Object from Image",
                userPrompt: "Process the attached image at {{s3_uri}} using INPAINTING. Target and flawlessly remove '{{object_to_remove_e.g._the_power_lines_in_the_background}}' while seamlessly reconstructing the {{background_element_e.g._sky}} behind them."
            },
            {
                promptName: "Expand Aspect Ratio",
                userPrompt: "Take the attached image at {{s3_uri}} and execute an OUTPAINTING operation. Expand the background landscape horizontally to a {{target_aspect_ratio_e.g._16:9}} cinematic aspect ratio, seamlessly extending the {{elements_to_extend_e.g._mountains_and_sky}}."
            },
            {
                promptName: "Create Image Variation",
                userPrompt: "Execute an IMAGE_VARIATION operation on the attached asset at {{s3_uri}} to generate {{number_of_variations}} alternative artistic interpretations, maintaining the original subject but exploring different {{variation_focus_e.g._dramatic_lighting_setups}}."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "generate_enterprise_image",
        publicName: "Enterprise Image Generator",
        systemPrompt: "You are an enterprise brand asset creator. Ensure all generated images strictly adhere to brand-safe, corporate aesthetics. Inject keywords to enforce high-quality, modern, clean lighting. Do NOT generate recognizable real-world people or copyrighted logos.",
        userPrompts: [
            {
                promptName: "Generate Branded Media",
                userPrompt: "Create a highly professional, brand-safe corporate image depicting {{business_concept_e.g._a_diverse_team_of_engineers_collaborating_around_a_holographic_data_table}}. Ensure lighting is {{lighting_preference_e.g._modern_and_bright}}."
            },
            {
                promptName: "Globalize Branded Media",
                userPrompt: "Generate a globally appealing, localized corporate marketing asset showing {{scene_description_e.g._professionals_shaking_hands_in_a_sleek_APAC-region_business_hub}}, ensuring no recognizable real-world logos are included."
            },
            {
                promptName: "Ideate Product Design",
                userPrompt: "Generate a clean, professional visualization of a {{product_concept_e.g._next-gen_IoT_gateway}}, placed in a {{setting_e.g._modern_server_room}}. Ensure the image aligns with {{brand_guidelines_e.g._minimalist_tech_aesthetics}} without including any recognizable logos."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "enterprise_voice_agent",
        publicName: "Enterprise AI Voice Agent",
        systemPrompt: "You are the commander of an autonomous Voice AI. You do NOT make the call directly—you dispatch a sub-agent. Provide the sub-agent with a meticulous 'objective' detailing behavior, tone, and objection handling. Define exact JSON keys in 'dataToCapture'. Instruct the user to wait, then execute CHECK_CALL_RESULTS to retrieve the outcome.",
        userPrompts: [
            {
                promptName: "Lead Qualifier",
                userPrompt: "Dispatch a Voice Agent to call {{target_phone_number}}. Objective: 'Act as a premium SDR. Qualify the prospect for our {{product_name}}, handle budget objections politely, and book a follow-up meeting.' Capture these data points: {{data_points_e.g._[BANT criteria, Decision Maker, Timeline]}}."
            },
            {
                promptName: "Reconnoitre",
                userPrompt: "Dispatch a Voice Agent to call {{target_phone_number}}. Objective: 'Act as a {{persona_e.g._prospective_client_or_researcher}} and subtly gather information regarding {{context_objectives_e.g._competitor_pricing_and_availability}}.' Capture these specific data points: {{data_points_e.g._[Pricing_Tiers,_Stock_Levels,_Feature_Gaps]}}. Once the call concludes, execute a check to retrieve the outcome and generate a comprehensive reconnaissance summary."
            },
            {
                promptName: "Notification",
                userPrompt: "Dispatch a Voice Agent to call {{target_phone_number}} to deliver an important notification. Objective: 'Deliver the following message clearly: \"{{message_content}}\". You MUST stay on the line until the recipient explicitly acknowledges receipt by saying the word \"{{acknowledgment_word_e.g._Confirmed_or_Understood}}\".' Capture: {{data_points_e.g._[Acknowledgment_Status,_Recipient_Remarks]}}. Monitor the call status and verify successful delivery."
            },
            {
                promptName: "NPS Survey",
                userPrompt: "Call {{target_phone_number}} with a {{voice_style_e.g._PROFESSIONAL_FEMALE}} voice. Objective: 'Conduct a post-implementation Net Promoter Score survey for {{service_name}}. Ask for a 1-10 rating, then kindly ask for one piece of critical feedback.' Capture: {{data_points_e.g._[NPS Score, Primary Feedback]}}."
            },
            {
                promptName: "Reservation",
                userPrompt: "Dispatch an urgent Voice Agent to call {{target_business_phone}}. Objective: 'Reserve a table for {{party_size}} people at {{time}} tonight under the name {{reservation_name}}, and confirm if they accommodate {{special_requests}}.' Capture: {{data_points_e.g._[Reservation Confirmed, Dietary Notes]}}."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "ULTRA_COMPUTE"
    },
    {
        toolName: "generate_audio",
        publicName: "TTS Voice Synthesis Agent",
        systemPrompt: "You are an audio production assistant. Convert user text into a natural, spoken-word format. Scrub emojis, URLs, and complex markdown before sending payloads to Polly. Select the optimal {{voiceId}} that matches the desired emotional tone.",
        userPrompts: [
            {
                promptName: "Synthesize Transcript",
                userPrompt: "Process the provided meeting transcript of {{meeting_topic}} for TTS generation. Scrub all markdown, optimize the text for natural pacing, and synthesize it using a {{voice_profile_e.g._highly_professional,_warm}} voice profile."
            },
            {
                promptName: "Generate Audiobook",
                userPrompt: "Convert the following chapter text from {{book_title}} into a long-form audio file. Ensure the tone is {{tone_e.g._engaging_and_dynamic}}, using a premium narrative voice profile suitable for a high-end audiobook."
            },
            {
                promptName: "Synthesize Narrator Script",
                userPrompt: "Process the provided {{text_source_e.g._product_launch_script}} for TTS generation. Scrub out any markdown or URLs, optimize for a {{pacing_e.g._slow_and_dramatic}} cadence, and synthesize using the {{voice_id}} voice profile."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "LOW_COMPUTE"
    },
   {
        toolName: "generate_luma_video",
        publicName: "Luma Dream Machine",
        systemPrompt: "You are an expert cinematic prompt engineer. Convert user requests into highly descriptive, visually rich prompts for Luma Ray. Focus exclusively on camera movement, lighting, subject action, and atmosphere. Maintain the {{aspectRatio}} strictly. Do NOT include text overlays in the prompt.",
        userPrompts: [
            {
                promptName: "Generate Ad Campaign",
                userPrompt: "Generate a cinematic {{aspect_ratio_e.g._16:9}} video of {{scene_subject_e.g._a_sleek_sports_car_driving_along_a_coastal_highway}} at {{lighting_condition_e.g._golden_hour}}. Ensure the camera motion is a {{camera_motion_e.g._dynamic_tracking_shot_from_a_drone_perspective}}."
            },
            {
                promptName: "Build Photorealistic Scene",
                userPrompt: "Create a photorealistic {{aspect_ratio_e.g._9:16}} video of {{scene_subject_e.g._rain_falling_slowly_on_a_cyberpunk_city_street}}, illuminated by {{lighting_elements_e.g._flickering_neon_signs}}. Use a {{camera_motion_e.g._slow,_creeping_zoom}} camera motion."
            },
            {
                promptName: "Script to Storyboard",
                userPrompt: "Analyze the provided script segment: '{{script_segment}}'. Extract the core narrative beats and generate a sequence of highly descriptive {{aspect_ratio_e.g._16:9}} storyboard video frames. Emphasize {{camera_angles_e.g._wide_establishing_shots_and_extreme_close-ups}} and consistent {{lighting_mood_e.g._high-contrast_noir_lighting}}."
            },
            {
                promptName: "Script to Movie",
                userPrompt: "Translate the following scene script: '{{scene_script}}' into a continuous, high-fidelity cinematic video sequence. Focus the prompt on capturing the exact subject action: {{subject_action}}, utilizing a {{camera_motion_e.g._fluid_Steadicam_tracking_shot}}, and maintaining a strict {{aspect_ratio_e.g._21:9}} aspect ratio."
            },
            {
                promptName: "Render Visual Effects",
                userPrompt: "Generate a hyper-realistic visual effects sequence featuring {{vfx_description_e.g._a_massive_plasma_explosion_in_a_dense_asteroid_field}}. Ensure the particle physics and lighting interact realistically with the surrounding environment. Apply a {{camera_motion_e.g._shaky_handheld_pan}} to enhance the visceral impact."
            },
            {
                promptName: "Animate Brand Logos",
                userPrompt: "Generate a dynamic, 3D motion-graphics sequence representing the brand '{{brand_name}}'. Focus on animating the brand's core visual motif: {{visual_motif_e.g._a_glowing_geometric_fox_made_of_liquid_metal_forming_in_mid-air}} using premium studio lighting and a {{camera_motion_e.g._smooth_orbital_reveal}}."
            },
            {
                promptName: "Expand Aspect Ratio",
                userPrompt: "Generate a sweeping, ultra-widescreen {{aspect_ratio_e.g._21:9}} video that dramatically establishes the visual scope of {{scene_concept_e.g._a_lone_astronaut_standing_on_a_desolate_alien_dune}}. Emphasize the vastness of the environment using a {{camera_motion_e.g._slow_pull-back_crane_shot}}."
            },
            {
                promptName: "Generate Instagram Reel",
                userPrompt: "Generate a high-engagement, vertical {{aspect_ratio_e.g._9:16}} video sequence tailored for an Instagram Reel campaign. Focus on a visually striking hook featuring {{scene_hook_e.g._a_vibrant_sneaker_stepping_into_a_neon_puddle_in_slow_motion}}. Utilize a {{camera_motion_e.g._rapid_whip-pan_transition}} and {{lighting_mood_e.g._high-contrast_studio_lighting}} to maximize immediate viewer retention."
            },
            {
                promptName: "Animate Image",
                userPrompt: "Extract the source image asset at {{s3_uri}} from context to serve as the initial keyframe. Transform the static shot into a breathtaking, fluid video sequence by seamlessly animating {{motion_subject_e.g._flowing_waterfall_mist_and_swirling_fog}}. Apply a {{camera_motion_e.g._slow_cinematic_push-in_with_subtle_parallax}} and enhance atmosphere with {{lighting_effects_e.g._dramatic_volumetric_sunbeams_shifting_through_clouds}} while strictly maintaining the original subject composition."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "ULTRA_COMPUTE"
    },
    {
        toolName: "generate_powerpoint_agent",
        publicName: "Enterprise Powerpoint Creator",
        systemPrompt: "You are a Fractional Chief Operating Officer and Expert Presentation Architect. Construct dense, highly professional PowerPoint payloads. Workflow: (1) Evaluate the core objective. (2) Structurally map the narrative arc (Introduction, Body, Data/Analysis, Conclusion). (3) Write precise speaker notes for each slide. (4) Map aesthetic coordinates (x, y, w, h) for all texts, shapes, and images to ensure clean, vivid layouts. Apply fluid slide transitions, element animations, and use the appropriate corporate theme constraint.",
        userPrompts: [
            {
                promptName: "Executive Pitch Deck",
                userPrompt: "Synthesize the provided business plan for '{{company_or_product_name}}' into a high-impact, 10-slide Executive Pitch Deck. Use the '{{theme_e.g._TECHNOLOGY}}' theme. Ensure every slide includes deep speaker notes, utilizes fluid 'zoom' transitions, and incorporates animated graphic shapes (e.g., interconnected nodes or process arrows) to visually map the go-to-market strategy."
            },
            {
                promptName: "Financial Quarterly Review",
                userPrompt: "Parse the attached {{data_source_e.g._Q3_financial_data}} and construct an authoritative Quarterly Business Review (QBR) presentation. Use the '{{theme_e.g._FINANCE}}' corporate template. Build vivid data layouts using shapes and aligned text blocks to highlight EBITDA and revenue margins. Apply 'fade' transitions between slides and strict executive cheat-sheets in the slide notes."
            },
            {
                promptName: "Marketing Campaign Kickoff",
                userPrompt: "Generate a vibrant presentation to kick off the upcoming '{{campaign_name}}' marketing campaign. Use the '{{theme_e.g._MARKETING}}' aesthetic. Coordinate the slides to include space for generated image URLs, apply 'fly' animations to the core messaging texts from the left, and ensure the narrative flows perfectly from target audience identification to expected ROI."
            },
            {
                promptName: "Agile Project Roadmap",
                userPrompt: "Translate the following engineering objectives into a structured Agile Project Management roadmap presentation. Use the '{{theme_e.g._CORPORATE}}' theme. Map out sprint milestones using horizontally aligned shapes (e.g., rightArrows and rects) across the slides to create a visual Gantt chart effect, apply 'push' transitions, and provide technical speaker notes."
            },
            {
                promptName: "Brand-Compliant Corporate Deck",
                userPrompt: "Analyze the attached corporate presentation template at {{s3_uri}}. Extract the strict design guidelines, including exact hex colors, typography hierarchy, and spatial layouts. Then, generate a highly professional {{slide_count_e.g._15}}-slide presentation on {{presentation_topic}} that flawlessly adheres to this reference architecture. Ensure all shapes, text alignments, and '{{transition_type_e.g._fade}}' animations match the enterprise brand identity exactly, and include comprehensive speaker notes for the presenter."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "generate_document_agent",
        publicName: "Document Generator Agent",
        systemPrompt: "You are an expert technical author. Generate perfectly structured files based on the requested 'format'. For 'csv', strictly use comma delimiters with no markdown wrappers. For 'html', output clean, styled, standalone HTML5. Ensure logical file naming and professional formatting.",
        userPrompts: [
            {
                promptName: "Generate Executive Report (HTML)",
                userPrompt: "Synthesize the provided {{data_source_e.g._Q3_financial_data}} into a professional HTML document named '{{file_name_e.g._Q3_Executive_Summary}}'. Include well-structured typography, CSS-styled tables, and clear section headers."
            },
            {
                promptName: "Generate Dataset (CSV)",
                userPrompt: "Compile the extracted {{data_source_e.g._CRM_leads}} into a clean, comma-delimited CSV dataset named '{{file_name_e.g._Q4_Qualified_Leads}}'. Ensure strict row/column formatting without any markdown wrappers."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "formstack_agile_agent",
        publicName: "Formstack Onboarding Agent",
        systemPrompt: "You are a Formstack Integration Engineer. You MUST construct endpoints perfectly according to the v2 documentation. Do NOT append '.json' to the endpoint. Pass URL queries into 'queryParams', and bodies into 'payload'. ROUTING: Forms: `/form`. Fields: `/form/{id}/field`. Submissions: `/form/{id}/submission`.",
        userPrompts: [
            {
                promptName: "Create Enterprise Form",
                userPrompt: "Design and deploy a Formstack form named '{{form_name_e.g._Enterprise_Vendor_Onboarding}}'. Include specific fields for {{required_fields_e.g._Company_Name,_Tax_ID,_and_Compliance_Uploads}}. Verify the structure and return the form_id and live shareable URL."
            },
            {
                promptName: "Send a Form",
                userPrompt: "Retrieve the shareable URL for Formstack form ID {{form_id}} and configure a {{notification_type_e.g._confirmation_email_or_notification}} to automatically distribute to {{target_audience_emails}}. Include the form link and the following custom message: '{{custom_message_e.g._Please_complete_your_vendor_profile}}'."
            },
            {
                promptName: "Get Form Submissions",
                userPrompt: "Connect to the Formstack API, navigate to the submissions endpoint for form ID {{form_id}}, retrieve the latest {{limit_e.g._50}} entries, and synthesize the data into a structured summary focusing on {{key_metrics_e.g._completion_rates}}."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "jotform_agile_agent",
        publicName: "Jotform Data Capture Agent",
        systemPrompt: "You are an Enterprise Data Capture Engineer utilizing the Jotform v1 API. Construct endpoints strictly according to documentation (e.g., `/user/forms`, `/form/{id}/questions`). Do NOT include the base URL. Use nested properties for JSON payloads accurately (e.g., `{\"questions[0][type]\": \"control_head\"}`).",
        userPrompts: [
            {
                promptName: "Create Agile Request Form",
                userPrompt: "Architect a new Jotform titled '{{form_name_e.g._Agile_Sprint_Intake}}'. Inject specific control fields for '{{field_1}}', '{{field_2}}', and '{{field_3}}', validate the nested property JSON, and return the form_id and live URL."
            },
            {
                promptName: "Send a Form",
                userPrompt: "Access Jotform ID {{form_id}}, retrieve its live URL, and configure an email distribution or autoresponder targeting {{target_audience_emails}}. Ensure the payload includes the form link and the following instructional message: '{{instructional_message_e.g._Please_submit_your_sprint_requests_by_Friday}}'."
            },
            {
                promptName: "Get Form Submissions",
                userPrompt: "Execute a GET request to the Jotform submissions endpoint for form ID {{form_id}}. Parse the returned responses, filter for {{filter_criteria_e.g._high-priority_items}}, and provide a detailed action report."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "airflow_pipeline_agent",
        publicName: "Airflow Pipeline Engineer",
        systemPrompt: "You are an autonomous Airflow Pipeline Reliability Engineer. Think step-by-step: first use GET_FAILED_TASKS to diagnose issues and read the logs. Formulate a hypothesis for the failure, and only after verifying the root cause should you attempt a DAG re-trigger or code fix. Ensure Python code includes proper DAG instantiation, default_args, and task dependencies.",
        userPrompts: [
            {
                promptName: "Diagnose Failed DAG",
                userPrompt: "Analyze the Airflow DAG '{{dag_id}}' for run ID '{{run_id}}'. Extract the failed tasks, fetch the execution logs, diagnose the root cause step-by-step, and recommend a remediation plan."
            },
            {
                promptName: "Deploy New Pipeline",
                userPrompt: "Generate a valid Python DAG script for a daily {{source}} to {{destination}} export. Include proper instantiation and task dependencies. Deploy it to Airflow as '{{file_name_e.g._snowflake_export.py}}' and trigger an immediate run."
            },
            {
                promptName: "Trigger DAG",
                userPrompt: "Execute a TRIGGER_DAG action to manually kick off the Airflow DAG '{{dag_id_e.g._nightly_billing_sync}}'. Inject the logical execution date '{{logical_date_e.g._2026-09-08T00:00:00Z}}'. After dispatching, verify that the run was successfully queued and report back the new DAG Run ID."
            },
            {
                promptName: "Get DAG Runs",
                userPrompt: "Execute a GET_DAG_RUNS action to audit the recent execution history for the '{{dag_id_e.g._user_activity_etl}}' DAG. Analyze the state of the last {{run_limit_e.g._10}} runs, calculate the average execution time, and highlight any recurring failure patterns or performance bottlenecks."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "airtable_data_agent",
        publicName: "Airtable Data Orchestrator",
        systemPrompt: "You are an Airtable data orchestration agent. Execute tasks systematically: (1) Always run INSPECT_SCHEMA first to map exact field names and types. (2) Formulate your query or mutation. (3) When using CREATE_RECORDS or UPDATE_RECORDS, strictly validate your payload against the schema. If bulk-processing, use INGEST_SPREADSHEET.",
        userPrompts: [
            {
                promptName: "Schema Inspection & Query",
                userPrompt: "Run an INSPECT_SCHEMA action on Airtable Base '{{base_id}}' to map fields for the '{{table_name}}' table. Then query for all records where '{{query_condition_e.g._StockLevel_<_10}}' and summarize the results."
            },
            {
                promptName: "Bulk Update Records",
                userPrompt: "Retrieve the schema for Base '{{base_id}}'. Find all records in the '{{table_name}}' table where '{{filter_condition_e.g._Status_=_New}}'. Formulate a strict payload to bulk-update their {{target_field}} to '{{new_value}}'."
            },
            {
                promptName: "Ingest Spreadsheet",
                userPrompt: "Retrieve the Excel spreadsheet located at {{file_url_e.g._https://example.com/Q3_Inventory.xlsx}}. Inspect the schema of Airtable Base '{{base_id}}' for the '{{table_name}}' table to ensure precise field alignment. Once validated, execute an INGEST_SPREADSHEET action to bulk-import all rows, automatically handling data type conversions for {{complex_field_e.g._Date_and_Single_Select_fields}}."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "alexa_agent",
        publicName: "Alexa Smart Home Agent",
        systemPrompt: "You are an autonomous Alexa Smart Home controller. Since discovery is unsupported, you must strictly rely on the user-provided 'endpointId'. Verify the target device type before constructing the namespace and payload to ensure strict adherence to the Alexa directive schema.",
        userPrompts: [
            {
                promptName: "Control Smart Home",
                userPrompt: "Send a directive to Alexa endpoint '{{endpoint_id}}'. Execute the '{{command_e.g._TurnOn}}' command within the '{{namespace_e.g._Alexa.PowerController}}' namespace to activate the {{target_device_e.g._living_room_lights}}."
            },
            {
                promptName: "Audit Device State",
                userPrompt: "Query the Alexa endpoint '{{endpoint_id}}' to retrieve the current telemetry payload. If the device state indicates {{undesired_state_e.g._unlocked}}, execute a CONTROL_DEVICE action to immediately switch it to {{desired_state_e.g._locked}}."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "amadeus_gds_agent",
        publicName: "Amadeus Travel GDS Agent",
        systemPrompt: "You are a corporate flight booking agent. Reason through travel logistics before querying: (1) Validate that origin and destination are correct 3-letter IATA codes. (2) Ensure the return date is chronologically after the departure date. (3) Fetch the flights and sort them by the user's priority (e.g., cost, duration) before summarizing.",
        userPrompts: [
            {
                promptName: "Corporate Flight Search",
                userPrompt: "Search Amadeus for round-trip flights from {{origin_iata}} to {{destination_iata}}, departing {{departure_date}} and returning {{return_date}} for {{passenger_count}} adult(s). Present the top {{limit}} options optimized for minimal layovers and lowest price."
            },
            {
                promptName: "Flight Order Management",
                userPrompt: "Execute GET_FLIGHT_ORDER for order ID '{{flight_order_id}}'. Extract the ticketing status and passenger details, cross-reference them against corporate travel policy, and generate a compliance summary for the finance department."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "arduino_iot_agent",
        publicName: "Arduino IoT Cloud Agent",
        systemPrompt: "You are a micro-controller operations agent. Perform a two-step validation: First, query the Arduino Thing to retrieve the specific propertyId and its expected data type. Second, convert your payload values to match the hardware's expected type perfectly before sending an update.",
        userPrompts: [
            {
                promptName: "Get Connected Things",
                userPrompt: "Execute a GET_THINGS action to discover all provisioned microcontrollers in the Arduino IoT Cloud. Cross-reference the returned fleet data and identify any devices in the {{environment_e.g._manufacturing_floor}} that are currently disconnected or reporting errors."
            },
            {
                promptName: "Get Connected Properties",
                userPrompt: "Retrieve the live telemetry data for Arduino Thing '{{thing_id}}' using GET_PROPERTIES. Analyze the incoming data streams for the {{sensor_type_e.g._environmental_sensors}}, and summarize any properties currently operating outside the safe threshold of {{safe_threshold_e.g._20C_to_25C}}."
            },
            {
                promptName: "Manage Connected Property",
                userPrompt: "Fetch the current state of the '{{property_name_e.g._CoolingFan_or_MainValve}}' property on Arduino Thing '{{thing_id}}'. Once verified, execute an UPDATE_PROPERTY action to change its value to {{new_state_e.g._true}} to actuate the hardware, and confirm the system acknowledged the state change."
            },
            {
                promptName: "Create Connected Property",
                userPrompt: "Execute a CREATE_PROPERTY action on Arduino Thing '{{thing_id}}' to provision a new telemetry variable named '{{new_property_name_e.g._VibrationIndex}}'. Configure the data type as {{data_type_e.g._FLOAT}} and set the update policy to {{update_policy_e.g._ON_CHANGE}} to enable real-time monitoring."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "asana_pm_agent",
        publicName: "Asana Project Coordinator",
        systemPrompt: "You are an autonomous Asana project coordinator. Do not blindly overwrite data. Use SEARCH_TASKS to fetch the current task state, assignees, and blocking statuses. Read the task context, then apply your updates while preserving existing crucial metadata. Assign appropriate workspace and project IDs.",
        userPrompts: [
            {
                promptName: "Triage Project Tasks",
                userPrompt: "Locate tasks in Asana workspace '{{workspace_id}}' related to '{{search_query_e.g._Q4_Launch}}'. Analyze their current status and assignees, then selectively update blocking tasks with new priority tags without overwriting existing descriptions."
            },
            {
                promptName: "Automated Task Creation",
                userPrompt: "Analyze the provided meeting notes. For every action item identified, execute CREATE_TASK in Asana workspace '{{workspace_id}}' with the task payload: {{task_payload_template}}, assigning them directly to the respective stakeholders."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "raspberry_pi_fleet_agent",
        publicName: "Balena Cloud IoT Fleet Agent",
        systemPrompt: "You are an edge device fleet manager. Diagnose issues methodically: (1) Check device status. (2) Pull and parse recent logs for fatal exceptions, memory leaks, or networking faults. (3) Only trigger REBOOT_DEVICE if your analysis confirms an unrecoverable state. Always output a diagnostic summary.",
        userPrompts: [
            {
                promptName: "Fleet Diagnostics",
                userPrompt: "Assess the health of Raspberry Pi device '{{device_uuid}}'. Fetch the recent application logs, identify any {{fault_pattern_e.g._memory_leak}} patterns, and automatically trigger a REBOOT_DEVICE action if critical faults are found."
            },
            {
                promptName: "Environment Config Sync",
                userPrompt: "Execute GET_FLEET_STATUS to identify all online devices. For device '{{device_uuid}}', read the current environment variables, then use SET_DEVICE_ENV_VAR to update '{{env_var_name_e.g._API_ENDPOINT}}' to '{{new_value}}'."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "bamboohr_agent",
        publicName: "BambooHR Liaison Agent",
        systemPrompt: "You are a BambooHR liaison agent. When locating personnel, always use 'searchName' in GET_DIRECTORY to tightly scope your query rather than pulling the whole company directory. Retrieve time-off balances and synthesize a clear approval recommendation based on the requested dates.",
        userPrompts: [
            {
                promptName: "Process PTO Request",
                userPrompt: "Search the directory for '{{employee_name}}'. Retrieve their current time-off balances. If they have sufficient accrued time, execute APPROVE_TIME_OFF for request ID '{{request_id}}' covering dates {{start_date}} to {{end_date}}."
            },
            {
                promptName: "Retrieve Compensation History",
                userPrompt: "Use GET_DIRECTORY to find the profile for '{{employee_name}}'. Retrieve their compensation and role history, and synthesize a brief summary detailing their progression over the last {{timeframe_e.g._3_years}}."
            },
            {
                promptName: "Department Structure Audit",
                userPrompt: "Use GET_DIRECTORY to pull all active employees in the '{{department_name_e.g._Engineering}}' department. Cross-reference their manager assignments and flag any employees missing a direct supervisor or mapped to an inactive manager."
            },
            {
                promptName: "Milestone & Anniversary Report",
                userPrompt: "Query the directory for all active employees. Filter the results to identify team members reaching their {{milestone_e.g._1_year_or_5_year}} work anniversary this month, and generate a structured recognition list for the executive team."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "booking_com_agent",
        publicName: "Booking.com Partner Agent",
        systemPrompt: "You are a corporate travel concierge. Cross-reference user requirements (location, dates, pax) against property policies. Always verify the currency and calculate total stay costs accurately before presenting options.",
        userPrompts: [
            {
                promptName: "Book Executive Travel",
                userPrompt: "Find accommodations in {{destination_city}} for {{passenger_count}} adult(s) from {{check_in_date}} to {{check_out_date}}. Filter for premium business-friendly amenities, calculate total costs in {{currency_code}}, and summarize the top {{limit}} executive options."
            },
            {
                promptName: "Order Status Audit",
                userPrompt: "Retrieve order details for Booking.com reservation '{{order_id}}'. Cross-reference the booking status and cancellation policy, then output a summary verifying compliance for the finance team."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "byo_mcp_agent",
        publicName: "Bring Your Own MCP Agent",
        systemPrompt: "You are a versatile interface bridging a user's custom MCP server. Your workflow MUST be: (1) Execute LIST_TOOLS immediately to discover capabilities. (2) Analyze the returned JSON schemas to understand exact parameter requirements. (3) Structure your CALL_TOOL payload perfectly matching the schema.",
        userPrompts: [
            {
                promptName: "Tool Discovery & Execution",
                userPrompt: "Connect to my local MCP server. Run a LIST_TOOLS sequence to discover capabilities, analyze the schema for the internal '{{target_tool_e.g._query_database}}' tool, and use it to execute: {{task_objective}}."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "butterflymx_access_agent",
        publicName: "ButterflyMX Access Agent",
        systemPrompt: "You are a security-first access control bot. Before issuing virtual keys or opening doors, verify the context of the request. Use GET_MY_ACCESS_LOGS to cross-reference past visitor history if requested, ensuring tenant safety.",
        userPrompts: [
            {
                promptName: "Issue VIP Access Key",
                userPrompt: "Create a virtual key for ButterflyMX building '{{building_id}}' for my guest '{{guest_name}}'. Configure the payload so the key is strictly active starting {{start_time}} for exactly {{duration_e.g._4_hours}}."
            },
            {
                promptName: "Access Log Audit",
                userPrompt: "Execute GET_MY_ACCESS_LOGS for tenant '{{tenant_id}}' in building '{{building_id}}'. Analyze the visitor history for the past {{timeframe_e.g._7_days}} and flag any unauthorized or suspicious access attempts."
            },
            {
                promptName: "Manage Vendor Access",
                userPrompt: "Verify the status of the front door device in building '{{building_id}}'. Execute OPEN_DOOR for the {{vendor_name}} delivery, then immediately retrieve the access log to confirm successful entry."
            },
            {
                promptName: "Tenant Move-Out Security Revocation",
                userPrompt: "Execute GET_TENANTS to locate the profile for '{{tenant_name_e.g._Jane_Doe}}' in building '{{building_id}}'. Once identified, use REVOKE_VIRTUAL_KEY to invalidate all their active passes, and execute an UPDATE_TENANT action to set '{{privacy_setting_e.g._directory_hidden}}' to true."
            },
            {
                promptName: "Automated Courier Access",
                userPrompt: "Create a time-bound virtual key using CREATE_VIRTUAL_KEY for building '{{building_id}}' assigned to '{{courier_name_e.g._FedEx_Freight}}'. Restrict access to {{date_e.g._tomorrow}} between {{start_time}} and {{end_time}}. Afterwards, monitor GET_ACCESS_LOGS to verify when the delivery was completed."
            },
            {
                promptName: "Emergency Access Override",
                userPrompt: "Execute GET_DEVICES to securely locate the precise device ID for the '{{target_door_e.g._Main_Lobby_Entrance}}' in building '{{building_id}}'. Immediately execute an OPEN_DOOR action to grant critical access to {{authorized_personnel_e.g._First_Responders}}, and subsequently fetch GET_ACCESS_LOGS to timestamp and document their entry."
            },
            {
                promptName: "Holiday Access Schedule Adjustment",
                userPrompt: "Execute GET_TENANTS to pull all profiles for building '{{building_id}}'. Formulate an UPDATE_TENANT payload to temporarily enforce restricted access hours for the upcoming {{holiday_name}} weekend."
            },
            {
                promptName: "Delivery Failure Investigation",
                userPrompt: "Pull GET_ACCESS_LOGS for device '{{device_id_e.g._Main_Entrance}}' during the specific delivery window of {{date_and_time}}. Filter the logs for the courier PIN '{{courier_pin}}' to determine if an entry attempt was actually made."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "confluence_wiki_agent",
        publicName: "Confluence Wiki Agent",
        systemPrompt: "You are a Technical Writer managing Confluence. Work systematically: Use precise CQL to retrieve the target page, read its current content to avoid destructive overwrites, and then append or modify using valid Atlassian Document Format (ADF) or XHTML storage format.",
        userPrompts: [
            {
                promptName: "Update Technical Specs",
                userPrompt: "Search Confluence using CQL for '{{cql_query_e.g._title_~_Architecture_v2}}'. Read the existing document content to preserve context, then append a new ADF-formatted section detailing the {{update_content_description}}."
            },
            {
                promptName: "Create Meeting Notes",
                userPrompt: "Create a new Confluence page titled '{{meeting_title}}' under parent ID '{{parent_page_id}}'. Structure the page data payload using ADF format to include an agenda, list of attendees, and an action items checklist."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "contentful_cms_agent",
        publicName: "Contentful CMS Manager",
        systemPrompt: "You are a headless CMS manager. Always respect content modeling rules. Fetch the contentType schema first if unsure. Ensure entryData schemas strictly match required fields. Resolve linked assets (images/references) if context is needed prior to mutation.",
        userPrompts: [
            {
                promptName: "Publish Blog Entry",
                userPrompt: "Validate the schema for the '{{content_type_e.g._blogPost}}' content type. Formulate a highly structured JSON payload, and create a new published entry containing a title, author reference, and rich text body about {{topic}}."
            },
            {
                promptName: "Content Localization Sync",
                userPrompt: "Use GET_ENTRIES to fetch all published entries for content type '{{content_type_id}}'. Identify those missing the '{{target_locale_e.g._es-ES}}' translation, and generate an UPDATE_ENTRY payload to apply the localized strings."
            },
            {
                promptName: "Audit Content Completeness",
                userPrompt: "Use GET_ENTRIES to pull all documents for the '{{content_type_e.g._productLandingPage}}' type. Identify any entries missing the {{target_field_e.g._heroImage_asset}} and generate a structured list of entry IDs requiring updates."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "datadog_monitoring_agent",
        publicName: "Datadog Telemetry Analyst",
        systemPrompt: "You are an autonomous Datadog telemetry analyst. Formulate multi-step investigations: (1) Query logs using exact Datadog tag syntax (e.g., env:prod). (2) Correlate log anomalies with metric spikes. (3) Synthesize a root cause analysis. If muting monitors, explicitly define the 'muteScope' to prevent global silences.",
        userPrompts: [
            {
                promptName: "Root Cause Investigation",
                userPrompt: "Investigate Datadog logs for '{{log_query_e.g._service:payment_status:error}}' over the last {{timeframe_e.g._hour}}. Correlate the errors with metric spikes in {{metric_e.g._CPU}}, synthesize a root cause analysis, and propose a mitigation strategy."
            },
            {
                promptName: "Automated Alert Muting",
                userPrompt: "Execute GET_MONITORS to find alerting monitors related to '{{service_name_e.g._redis-cache}}'. Since an expected maintenance window is active, execute MUTE_MONITOR for monitor ID '{{monitor_id}}' using the scope '{{mute_scope_e.g._env:staging}}'."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "dynamics_365_agent",
        publicName: "Dynamics 365 Automation Agent",
        systemPrompt: "You are an autonomous Microsoft Dynamics 365 agent. Always verify that 'entityPluralName' is formatted correctly (e.g., 'opportunities'). Construct OData queryOptions ($filter, $select, $top) carefully to fetch only the necessary subset of data, then process the entities before executing updates.",
        userPrompts: [
            {
                promptName: "Lead Routing Optimization",
                userPrompt: "Fetch Dynamics 365 records for '{{entity_plural_e.g._leads}}' using the OData query '{{odata_query_e.g._$top=50&$filter=statuscode_eq_1}}'. Analyze the unassigned leads and execute UPDATE_RECORD to assign them to the {{target_queue_e.g._enterprise_sales_queue}}."
            },
            {
                promptName: "Pipeline Health Audit",
                userPrompt: "Retrieve Dynamics 365 records for '{{entity_plural_e.g._opportunities}}' using the query '{{odata_query_e.g._$filter=estimatedvalue_gt_50000_and_statecode_eq_0}}'. Analyze the estimated close dates and output a summary of high-value opportunities at risk of slipping."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "etrade_financial_agent",
        publicName: "E*TRADE Financial Agent",
        systemPrompt: "You are an agentic E*TRADE financial manager. Always follow strict multi-step execution logic for trading operations: 1) If 'accountIdKey' is missing, execute LIST_ACCOUNTS first. 2) Before placing any order, query real-time quotes using GET_QUOTE and check available buying power using GET_ACCOUNT_BALANCE. 3) MANDATORY SAFETY RULE: Always execute PREVIEW_ORDER before calling PLACE_ORDER to verify order impact, estimated commissions, and price compliance. Provide clear, synthesized financial insights on portfolio risk and position allocations.",
        userPrompts: [
            {
                promptName: "Portfolio Health & Allocation Audit",
                userPrompt: "Execute LIST_ACCOUNTS to identify all active brokerage accounts. For account key '{{account_id_key}}', pull current balances via GET_ACCOUNT_BALANCE and full active positions via VIEW_PORTFOLIO. Analyze asset allocation, highlight cash reserves vs equities, flag over-concentrated positions exceeding {{max_concentration_pct_e.g._20}}% of total equity, and synthesize a portfolio health summary."
            },
            {
                promptName: "Preview & Execute Equity Trade",
                userPrompt: "Query GET_QUOTE for symbol '{{ticker_symbol_e.g._AAPL}}' to inspect market pricing. Retrieve available buying power for account '{{account_id_key}}' using GET_ACCOUNT_BALANCE. Execute PREVIEW_ORDER to {{action_BUY_or_SELL}} {{quantity}} shares at {{price_type_MARKET_or_LIMIT}} price {{limit_price_if_applicable}}. Review the preview for commission impact and estimated total cost, then proceed to PLACE_ORDER."
            },
            {
                promptName: "Active Order Audit & Cancellation",
                userPrompt: "Execute CHECK_ORDER_STATUS for account '{{account_id_key}}'. Filter for open or pending orders associated with ticker '{{ticker_symbol_e.g._TSLA}}'. If an open order matches order ID '{{order_id_to_cancel}}', call CANCEL_ORDER and confirm successful cancellation."
            },
            {
                promptName: "Target Price Limit Order Setup",
                userPrompt: "Fetch real-time quotes for '{{ticker_symbol_e.g._NVDA}}' using GET_QUOTE. Compare current market price against target limit price ${{target_price}}. If current market price is within {{price_buffer_pct_e.g._2}}% of the target, execute PREVIEW_ORDER for a LIMIT {{action_BUY_or_SELL}} order of {{quantity}} shares at ${{target_price}} on account '{{account_id_key}}'."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "read_user_attachment",
        publicName: "File Attachment Analyzer",
        systemPrompt: "You are an intelligent file parsing agent. Extract the S3 URI from the hidden [System Context]. Read the attachment iteratively: extract the raw text or trigger the vision sub-agent for media. Synthesize the extracted data thoroughly before answering the user's specific query.",
        userPrompts: [
            {
                promptName: "Financial Extraction",
                userPrompt: "Read the securely uploaded PDF attachment at {{s3_uri}}. Parse the document step-by-step, reconstruct any fragmented tabular data, and extract all {{target_data_e.g._Q3_revenue_figures}} into a clean JSON structure."
            },
            {
                promptName: "Legal Contract Review",
                userPrompt: "Analyze the securely uploaded contract at {{s3_uri}}. Parse the document to extract key clauses related to {{clause_topic_e.g._termination_and_liability}}, flag any non-standard terms, and output a structured risk summary."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "github_developer_agent",
        publicName: "GitHub Operations Agent",
        systemPrompt: "You are a Senior Staff Software Engineer. Never blindly overwrite files. Workflow: (1) Run GET_TREE to understand the repo structure. (2) Read the target file to establish context. (3) Formulate atomic, secure code changes. (4) Create a branch and commit with a clear, descriptive message.",
        userPrompts: [
            {
                promptName: "Automated Bug Fix",
                userPrompt: "Run GET_TREE on '{{owner}}/{{repo}}'. Read '{{file_path}}', identify the {{issue_description_e.g._null-pointer_exception}}, apply a secure atomic fix, create a new branch '{{branch_name}}', and open a Pull Request with a detailed markdown body."
            },
            {
                promptName: "Code Review & Audit",
                userPrompt: "Run SEARCH_CODE within '{{owner}}/{{repo}}' for '{{vulnerability_pattern_e.g._hardcoded_secrets}}'. Analyze the flagged files, create a new branch '{{branch_name}}' to implement secure environment variable patterns, and open a PR with a remediation summary."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "gitlab_developer_agent",
        publicName: "GitLab DevSecOps Agent",
        systemPrompt: "You are a GitLab DevSecOps orchestrator. Retrieve MR changes and analyze diffs critically for performance, logic errors, and security flaws. Only approve if the code meets strict enterprise standards. URL-encode project IDs if passing the 'group/project' namespace format.",
        userPrompts: [
            {
                promptName: "Automated Code Review",
                userPrompt: "Fetch the diffs for GitLab Merge Request #{{merge_request_iid}} in project '{{project_id}}'. Perform a deep DevSecOps code review, identify any performance or security flaws, and post a constructive line-comment summary."
            },
            {
                promptName: "Trigger CI/CD Pipeline Fix",
                userPrompt: "Retrieve the pipeline logs for the failing job in project '{{project_id}}'. Diagnose the build failure, use COMMIT_FILE to apply a fix to the '{{config_file_e.g._.gitlab-ci.yml}}' on branch '{{branch_name}}', and document the changes."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "alphabet_home_agent",
        publicName: "Google Smart Home Assistant",
        systemPrompt: "You are an autonomous Smart Device Management (SDM) controller. To control a device, you must query the home graph first, identify the target device trait, and then structure the command exactly per the Google SDM specification (e.g., sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat).",
        userPrompts: [
            {
                promptName: "Automated Climate Control",
                userPrompt: "Scan my Google Home network via SDM to find the primary thermostat. Check the ambient temperature, and if it is below {{min_temp}}, set the heat setpoint to {{target_temp}}."
            },
            {
                promptName: "Security Audit",
                userPrompt: "Scan my Google Home network via SDM to identify all devices with the '{{target_trait_e.g._CameraLiveStream}}' trait. Verify their current streaming status and ensure all cameras in the {{zone_e.g._living_room}} are disabled."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "google_workspace_agent",
        publicName: "Google Workspace Assistant",
        systemPrompt: "You are an Executive Assistant operating inside Google Workspace. If asked to modify a document or event, search and retrieve the current state first. When creating Calendar events, strictly validate that startTime and endTime are valid ISO-8601 strings.",
        userPrompts: [
            {
                promptName: "Meeting Minutes Workflow",
                userPrompt: "Use SEARCH_DRIVE to locate the '{{document_name_e.g._Q3_All_Hands}}' document. Read the contents, extract the key action items, and execute CREATE_CALENDAR_EVENT for {{meeting_time_e.g._next_week}} based on the findings."
            },
            {
                promptName: "Email Triage",
                userPrompt: "Execute READ_GMAIL using the query '{{search_query_e.g._is:unread_label:urgent}}'. Summarize the threads, and draft an appropriate response using SEND_GMAIL to acknowledge receipt to the senders."
            },
            {
                promptName: "Free/Busy Scheduling",
                userPrompt: "Execute GET_FREE_BUSY for the participants {{attendee_emails}} between {{start_time}} and {{end_time}}. Identify a 45-minute overlapping free block and execute CREATE_CALENDAR_EVENT for the '{{meeting_title}}' sync."
            },
            {
                promptName: "Automated Report Distribution",
                userPrompt: "Use SEARCH_DRIVE to find '{{report_name_e.g._Weekly_Sales_Metrics}}'. Read the document to extract the executive summary, and execute SEND_GMAIL to email this summary to {{stakeholder_emails}}."
            },
            {
                promptName: "Event Conflict Resolution",
                userPrompt: "Execute GET_FREE_BUSY for {{executive_email}} between {{start_time}} and {{end_time}}. Identify any double-booked slots, and draft a summary of conflicting events recommending which lower-priority meeting to reschedule."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "grafana_observability_agent",
        publicName: "Grafana Observability Agent",
        systemPrompt: "You are a Site Reliability Engineer expert in PromQL and LogQL. When querying metrics, format PromQL correctly and define appropriate step limits to avoid timeouts. Analyze the resulting time-series data to detect anomalies before returning a summary to the user.",
        userPrompts: [
            {
                promptName: "Metric Anomaly Detection",
                userPrompt: "Execute a PromQL query on data source '{{data_source_uid}}' for '{{promql_query_e.g._rate(http_requests_total[5m])}}' over the last {{time_window_e.g._2_hours}}. Identify any significant latency spikes or error anomalies and summarize the findings."
            },
            {
                promptName: "LogQL Error Tracing",
                userPrompt: "Run a LogQL query on '{{loki_data_source}}' to extract the last {{limit_e.g._100}} lines containing '{{error_signature_e.g._OutOfMemoryException}}'. Correlate these logs with the provided timeframe and output a timeline of the failure cascade."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "home_assistant_agent",
        publicName: "HomeKit Home Assistant Agent",
        systemPrompt: "You are a Home Assistant automation specialist. Route CONTROL_DEVICE commands intelligently by specifying the exact domain (e.g., 'light') and service (e.g., 'turn_off'). Use RENDER_TEMPLATE to validate Jinja2 logic before applying complex automations to the home network.",
        userPrompts: [
            {
                promptName: "Orchestrate Smart Routines",
                userPrompt: "Verify the state of '{{sensor_entity_e.g._sensor.living_room_motion}}'. If active, call the '{{service_e.g._turn_on}}' service on the '{{domain_e.g._light}}' domain for '{{target_entity}}' and render a Jinja2 template to confirm execution."
            },
            {
                promptName: "Diagnostics & Recovery",
                userPrompt: "Fetch the historical state of '{{entity_id_e.g._climate.hvac_system}}' over the last {{timeframe_e.g._12_hours}}. Identify any offline drops, then execute the '{{service_name_e.g._restart}}' service to reset the entity if it is currently unresponsive."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "hubspot_crm_agent",
        publicName: "HubSpot RevOps Assistant",
        systemPrompt: "You are a HubSpot RevOps assistant. Do not assume entity IDs. Always use SEARCH_OBJECTS with properly formatted filterGroups to locate the correct contacts or deals first. When updating, log comprehensive details using LOG_ENGAGEMENT to ensure sales reps have full context.",
        userPrompts: [
            {
                promptName: "Deal Progression",
                userPrompt: "Search HubSpot for '{{object_type_e.g._deals}}' matching the filter for '{{filter_criteria_e.g._Pipeline:_Sales}}'. Identify stagnant deals, update their lifecycle stage, and log a detailed engagement note for the account executives to follow up."
            },
            {
                promptName: "SLA Breach Prevention",
                userPrompt: "Search HubSpot for '{{object_type_e.g._tickets}}' where the '{{filter_criteria_e.g._time_to_close_is_greater_than_48h}}'. For each SLA-breaching ticket, use UPDATE_OBJECT to escalate the priority to 'High' and log a warning note for the support manager."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "jira_agile_agent",
        publicName: "Jira Agile Project Manager",
        systemPrompt: "You are a Scrum Master AI. Write precise JQL to locate issues. Workflow: (1) Run GET_ISSUE to verify the ticket's current status and available transition IDs. (2) Execute the transition or update. (3) Append clear, actionable, markdown-formatted comments detailing the changes made.",
        userPrompts: [
            {
                promptName: "Sprint Backlog Grooming",
                userPrompt: "Query Jira using JQL '{{jql_query_e.g._project_=_EN_AND_status_=_Backlog}}'. Analyze the returned issues, transition high-priority bugs to '{{target_status_e.g._In_Progress}}', and log a summary comment indicating the sprint inclusion."
            },
            {
                promptName: "Automated Epic Rollup",
                userPrompt: "Search Jira using JQL '{{jql_query_e.g._parent_=_EPIC-123}}'. Aggregate the status of all child stories, calculate the overall completion percentage, and add a comment to the parent Epic summarizing the progress."
            },
            {
                promptName: "Stale Ticket Auto-Resolution",
                userPrompt: "Execute SEARCH_ISSUES using JQL '{{jql_query_e.g._project_=_CORE_AND_status_=\"Waiting_on_Customer\"_AND_updated_<=_-14d}}'. For every stale ticket found, use TRANSITION_ISSUE to move it to '{{target_status_e.g._Closed}}', and execute ADD_COMMENT to notify the reporter that the issue was auto-closed due to inactivity."
            },
            {
                promptName: "Cross-Team Bug Escalation",
                userPrompt: "Execute GET_ISSUE for ticket '{{issue_key_e.g._WEB-404}}' to analyze the bug context. Use CREATE_ISSUE to spawn a related ticket in the '{{target_project_key_e.g._DEVOPS}}' project containing the infrastructure requirements, then use ADD_COMMENT on the original ticket to link the newly escalated issue."
            },
            {
                promptName: "Release Readiness Audit",
                userPrompt: "Run SEARCH_ISSUES for all tickets matching JQL '{{jql_query_e.g._fixVersion_=_\"v2.5.0\"_AND_status_!=_Done}}'. Analyze the remaining blockers, and execute ADD_COMMENT on the release tracking Epic '{{epic_key}}' with a markdown-formatted report detailing exactly which issues are delaying the deployment."
            },
            {
                promptName: "Automated Task & Subtask Creation",
                userPrompt: "Analyze the provided feature requirements for '{{feature_name_e.g._SSO_Integration}}'. First, use CREATE_ISSUE to generate a parent Task in the '{{project_key_e.g._ENG}}' project. Once the parent ticket is created, break the work down into logical steps and execute CREATE_ISSUE sequentially to generate the corresponding Subtasks, ensuring each is explicitly linked to the new parent issue key."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "linkedin_sales_agent",
        publicName: "LinkedIn Sales Navigator",
        systemPrompt: "You are an Account Executive AI assistant. When searching leads or accounts via LinkedIn Sales Navigator, pull profile data, cross-reference firmographic metrics, and synthesize a highly targeted outreach summary or persona analysis.",
        userPrompts: [
            {
                promptName: "Executive Persona Brief",
                userPrompt: "Locate the LinkedIn profile for the {{target_role_e.g._CTO}} of {{target_company_e.g._Acme_Corp}}. Extract their recent activity and firmographic data, and synthesize a strategic outreach brief tailored to our {{product_pitch_e.g._enterprise_cybersecurity_product}}."
            },
            {
                promptName: "Account Mapping",
                userPrompt: "Execute a GET_ACCOUNT action for the LinkedIn company profile '{{company_id_or_name}}'. Extract key leadership changes, recent company posts, and synthesize a compelling icebreaker tailored for the {{target_department_e.g._VP_of_Engineering}}."
            },
            {
                promptName: "Competitor Talent Sourcing",
                userPrompt: "Execute SEARCH_LEADS for individuals with the title '{{target_title_e.g._Senior_Software_Engineer}}' currently working at '{{competitor_company}}'. Extract their profiles and draft personalized recruitment outreach messages for the top {{limit}} candidates."
            },
            {
                promptName: "Buying Committee Mapping",
                userPrompt: "Run GET_ACCOUNT for '{{target_company}}'. Identify key decision-makers in the {{department_e.g._IT_or_Finance}} department, and synthesize a multi-threaded account penetration strategy detailing who to contact first and with what message."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "generate_luma_video_presentation",
        publicName: "Luma Presentation Generator",
        systemPrompt: "You are a Cinematic AI Director and Presentation Deck Orchestrator. Construct the 'slides' array perfectly for narrative flow. STRICT CONSTRAINTS: Each 'sceneVisualPrompt' MUST be under 350 characters and focus purely on visual composition (camera, lighting, subjects). Do NOT include text instructions inside the visual prompt—use the 'overlayText' property. If a 'voiceoverStyle' is requested, pace the 'speakerScript' for a 5-second slide duration.",
        userPrompts: [
            {
                promptName: "Cinematic Pitch Deck",
                userPrompt: "Generate a cinematic video deck detailing the launch of our new {{topic_e.g._AI_SaaS_platform}}. Use a '{{theme_e.g._TECH_STARTUP}}' theme, apply a '{{voice_e.g._PROFESSIONAL_FEMALE}}' voiceover, and structure exactly {{slide_count}} slides with dynamic overlays and scripts."
            },
            {
                promptName: "Product Launch Trailer",
                userPrompt: "Generate a dynamic video presentation for {{product_name}}. Use the '{{theme_e.g._ENTERTAINMENT_VIVID}}' aesthetic and a '{{voice_e.g._ENERGETIC_PITCH}}' voiceover. Create exactly {{slide_count}} scenes focusing on dramatic feature reveals and bold text overlays."
            }
        ],
        modelAvailability: "ALL_AGENTS",
        costImpact: "ULTRA_COMPUTE"
    },
    {
        toolName: "notion_workspace_agent",
        publicName: "Notion Workspace Agent",
        systemPrompt: "You are a Notion content organizer. Recognize that Notion treats content as deeply nested blocks. When searching or extracting, recursively iterate through the page blocks to formulate a complete, accurate markdown summary before applying modifications.",
        userPrompts: [
            {
                promptName: "Status Update Synthesis",
                userPrompt: "Locate the Notion page titled '{{page_title_e.g._Q3_All_Hands}}'. Recursively retrieve its nested block content, extract all assigned action items, and append a formatted 'Status Update' checklist block at the bottom."
            },
            {
                promptName: "Database Sync",
                userPrompt: "Search for the Notion database titled '{{database_name_e.g._Product_Roadmap}}'. Retrieve the latest entries, filter for tasks marked as '{{status_e.g._Blocked}}', and extract the detailed block content to generate a blocker report."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "extract_pdf",
        publicName: "PDF OCR Extractor",
        systemPrompt: "You are a specialized data extraction agent. Pass the fileUrl directly to the tool. Read the resulting text critically; recognize that OCR can occasionally merge columns or lose table structures. Apply deep reasoning to reconstruct tabular/financial data accurately before providing your final analysis.",
        userPrompts: [
            {
                promptName: "Invoice Data Capture",
                userPrompt: "Process the provided invoice PDF at {{s3_uri}} using OCR. Carefully reconstruct the itemized billing table, cross-checking totals, and extract the vendor details into a structured data format."
            },
            {
                promptName: "Compliance Audit",
                userPrompt: "Process the policy PDF at {{s3_uri}} using OCR. Extract the sections pertaining to {{compliance_topic_e.g._data_retention}}, cross-check against standard SOC2 requirements, and output a list of missing policy statements."
            },
            {
                promptName: "Resume Parsing & Scoring",
                userPrompt: "Process the candidate resume PDF at {{s3_uri}} using OCR. Extract their work history and technical skills, cross-reference them against the {{job_title}} job description, and output a structured candidate fit score and skills gap analysis."
            },
            {
                promptName: "Technical Manual Diagnostics",
                userPrompt: "Read the complex equipment manual PDF at {{s3_uri}}. Search the extracted text for troubleshooting steps specifically related to error code '{{error_code_e.g._E-404}}', and format the solution as a step-by-step JSON guide."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "pagerduty_sre_agent",
        publicName: "PagerDuty SRE Agent",
        systemPrompt: "You are an incident response coordinator optimizing for MTTR. Workflow: (1) Use GET_ON_CALL to identify the active responder for the service. (2) Trigger or update the incident with precise diagnostic context. (3) Keep resolution notes concise and actionable.",
        userPrompts: [
            {
                promptName: "Incident Escalation",
                userPrompt: "Check who is on-call for PagerDuty service '{{service_id_e.g._srv-db}}'. Trigger a {{urgency_e.g._high}}-urgency incident titled '{{incident_title_e.g._Database_Latency_Spike}}', assign it to the active responder, and append initial diagnostic logs as a note."
            },
            {
                promptName: "Post-Mortem Gathering",
                userPrompt: "Retrieve the timeline for PagerDuty incident '{{incident_id}}'. Extract all acknowledged timestamps, resolution notes, and attached alerts to automatically generate the foundation for a blameless post-mortem document."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "priceline_partner_agent",
        publicName: "Priceline Travel Agent",
        systemPrompt: "You are a Priceline hotel booking and management concierge. When searching, cross-reference user criteria against precise destinations and review scores. ALWAYS ask for explicit user confirmation before executing any CANCEL_RESERVATION action.",
        userPrompts: [
            {
                promptName: "Event Lodging Logistics",
                userPrompt: "Search Priceline for hotels in {{destination_city_e.g._Austin,_TX}} for the dates {{date_range}}. Filter by {{star_rating_e.g._4-star}} guest reviews and proximity to the {{landmark_e.g._convention_center}}, and summarize the top {{limit}} booking options."
            },
            {
                promptName: "Group Booking Evaluation",
                userPrompt: "Search Priceline for hotels in {{destination_city}} for the dates {{date_range}}. Filter for properties that can accommodate a group of {{group_size}} adults. Extract the top {{limit}} options with aggregate review scores above {{min_score}}."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "rippling_hr_agent",
        publicName: "Rippling HR Admin Agent",
        systemPrompt: "You are a strictly confidential Rippling HR administrative agent. Handle data with absolute care. Always verify employee identity using GET_EMPLOYEE before executing UPDATE or TERMINATE actions. Never expose PII or compensation data unless explicitly requested by an authorized user.",
        userPrompts: [
            {
                promptName: "Role Transition Processing",
                userPrompt: "Securely fetch the employee record for ID '{{employee_id}}'. Verify their current department, then execute an UPDATE_EMPLOYEE action to promote their job title to '{{new_title}}' and transition them to the {{new_department}} manager."
            },
            {
                promptName: "Automated Onboarding",
                userPrompt: "Execute an ONBOARD_EMPLOYEE action in Rippling. Use the provided {{employee_data_json}} payload to provision their profile, set their manager to ID '{{manager_id}}', and initiate the standard IT equipment provisioning workflow."
            },
            {
                promptName: "Automated Offboarding Sequence",
                userPrompt: "Fetch the employee record for '{{employee_id}}'. Extract their active software licenses and hardware assignments. Execute TERMINATE_EMPLOYEE with the effective date '{{termination_date}}', and generate a structured IT offboarding checklist."
            },
            {
                promptName: "Annual Compensation Review",
                userPrompt: "Securely fetch the employee record for '{{employee_id}}'. Verify their current base salary, then use UPDATE_EMPLOYEE to apply a {{raise_percentage_e.g._5%}} merit increase effective {{effective_date}}, ensuring the change is logged for payroll."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "sap_erp_agent",
        publicName: "SAP ERP Integration Agent",
        systemPrompt: "You are an SAP OData integration specialist mapping complex ABAP backend structures. Ensure all REST endpoints begin precisely with '/sap/opu/odata/sap/'. Retrieve data payloads, parse the EDMX formatting, and translate business logic clearly.",
        userPrompts: [
            {
                promptName: "Supply Chain Audit",
                userPrompt: "Execute an OData GET request to '{{odata_endpoint_e.g._/sap/opu/odata/sap/API_SALES_ORDER_SRV}}'. Parse the complex ABAP payloads, analyze the lead time data for the top {{limit_e.g._5}} products, and identify any fulfillment bottlenecks."
            },
            {
                promptName: "Inventory Reconciliation",
                userPrompt: "Execute an OData GET request to '{{odata_endpoint_e.g._/sap/opu/odata/sap/API_PRODUCT_SRV}}'. Parse the response to identify products where the available stock is below the {{reorder_threshold}}, and output a structured reorder list."
            },
            {
                promptName: "Vendor Payment Verification",
                userPrompt: "Execute an OData GET request to '{{odata_endpoint_e.g._/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV}}' for Purchase Order '{{purchase_order_id}}'. Cross-reference the goods receipts and determine if the associated invoice is cleared for payment."
            },
            {
                promptName: "Automated Hold Release",
                userPrompt: "Query SAP via OData to fetch all Sales Orders currently on credit hold. Evaluate the associated customer payment histories, and generate a POST payload to release holds for low-risk accounts."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "salesforce_crm_agent",
        publicName: "Salesforce RevOps Agent",
        systemPrompt: "You are a Salesforce Revenue Operations agent. Write exact, valid SOQL queries. Always verify that 'objectName' matches Salesforce standard API names. Query the target record first to confirm its state, then pass only the exact fields changing in the recordData payload.",
        userPrompts: [
            {
                promptName: "Pipeline Overhaul",
                userPrompt: "Execute SOQL: '{{soql_query_e.g._SELECT_Id,_StageName_FROM_Opportunity_WHERE_IsClosed_=_false}}'. Analyze the records, identify opportunities stagnant for 30+ days, and log an activity task for the owner to follow up."
            },
            {
                promptName: "Case Escalation",
                userPrompt: "Execute a SOQL query to find all 'Case' records where '{{condition_e.g._Priority_=_High_AND_IsEscalated_=_false}}'. For each record found, update the 'IsEscalated' field to true and assign it to the {{escalation_queue_id}}."
            },
            {
                promptName: "Churn Risk Mitigation",
                userPrompt: "Execute SOQL: '{{soql_query_e.g._SELECT_Id,_Name_FROM_Account_WHERE_Health_Score__c_<_50}}'. For each at-risk account, use CREATE_RECORD to generate a 'High Priority' Case and assign it directly to the Customer Success retention queue."
            },
            {
                promptName: "Quote-to-Cash Validation",
                userPrompt: "Query the Closed-Won Opportunity '{{opportunity_id}}'. Verify that all attached OpportunityLineItems have valid pricing arrays, and if perfectly reconciled, update the '{{custom_field_e.g._Ready_For_Billing__c}}' field to true."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "sanity_cms_agent",
        publicName: "Sanity.io CMS Agent",
        systemPrompt: "You are a Sanity GROQ and schema expert. Draft exact GROQ strings to fetch documents. Analyze the document state locally. When executing mutations, structure the JSON array perfectly to prevent CMS corruption and apply atomic updates.",
        userPrompts: [
            {
                promptName: "Bulk Content Mutation",
                userPrompt: "Run a GROQ query to find all documents of type '{{document_type_e.g._article}}' missing a '{{target_field_e.g._seoDescription}}'. Formulate a precise, atomic JSON mutation payload to update these documents with generated {{update_content_e.g._SEO_summaries}}."
            },
            {
                promptName: "Content Archival",
                userPrompt: "Run a GROQ query to locate all '{{document_type_e.g._event_promo}}' documents where the '{{date_field_e.g._endDate}}' is strictly in the past. Formulate a mutation payload to update their status to 'archived'."
            },
            {
                promptName: "Automated Taxonomy Tagging",
                userPrompt: "Run a GROQ query to find all '{{document_type_e.g._blogPost}}' documents where the 'tags' array is empty. Analyze their content, dynamically generate relevant taxonomy tags, and execute a MUTATE_DOCUMENT action to apply them."
            },
            {
                promptName: "Author Attribution Cleanup",
                userPrompt: "Use GROQ to locate documents referencing the archived author '{{archived_author_id}}'. Formulate a mutation payload to batch-update their author reference to the generic '{{new_author_id_e.g._Editorial_Team}}'."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "execute_vanguard_qa",
        publicName: "Selenium Grid QA Agent",
        systemPrompt: "You are a Lead SDET operating the Vanguard QA Engine. Map requests to precise, sequential test steps. ACTION ROUTING GUIDE: Use explicit verbs (e.g., 'navigate', 'click', 'type', 'assert_visible', 'wait'). Validate 'targetUrlOrApp' and 'platform' (CHROME, FIREFOX, IOS, ANDROID). STRICT RULE: Every execution MUST include a 'jiraTicketKey' to log trace artifacts.",
        userPrompts: [
            {
                promptName: "E2E Checkout Automation",
                userPrompt: "Run an automated test sequence on {{platform_e.g._WEB_CHROME}} targeting '{{target_url_e.g._https://shop.example.com}}'. Bind execution to Jira ticket '{{jira_ticket_key}}'. Perform actions: navigate to product, click add to cart, type payment details, and assert success message visibility."
            },
            {
                promptName: "Mobile App Sanity Check",
                userPrompt: "Run an automated test sequence on {{platform_e.g._MOBILE_IOS}} targeting the {{app_bundle_id}}. Bind execution to Jira ticket '{{jira_ticket_key}}'. Perform actions: tap the login button, assert the biometric prompt is visible, and capture a final screenshot."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "servicenow_itsm_agent",
        publicName: "ServiceNow Automation Bot",
        systemPrompt: "You are an IT Service Management automation bot adhering to ITIL practices. Use encoded query strings correctly for QUERY_INCIDENTS. When resolving an incident, analyze the history first, then provide comprehensive 'resolutionNotes' and a valid 'closeCode'.",
        userPrompts: [
            {
                promptName: "Automated Incident Resolution",
                userPrompt: "Query active incidents using '{{encoded_query_e.g._priority=1^state=New}}'. Analyze the logs, implement the known fix, and transition the incident using RESOLVE_INCIDENT with detailed resolutionNotes and a valid closeCode."
            },
            {
                promptName: "Problem Record Linkage",
                userPrompt: "Query ServiceNow for all incidents matching the encoded query '{{encoded_query_e.g._short_descriptionLIKEserver_crash}}'. Extract their sys_ids and summarize the impact to help the Problem Management team link them to a root cause record."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "shopify_admin_agent",
        publicName: "Shopify Store Administrator",
        systemPrompt: "You are an expert E-Commerce Operations Executive and Shopify Administrator. Execute actions systematically: (1) Verify target endpoints and parameters. (2) For complex store analysis, perform a GET_FINANCIAL_INSIGHTS action first. (3) When creating or mutating products, price rules, or customer records, validate payloads against Shopify Admin REST specifications. (4) Summarize financial outputs clearly with actionable operational recommendations.",
        userPrompts: [
            {
                promptName: "Executive Store Financial Health",
                userPrompt: "Execute a GET_FINANCIAL_INSIGHTS action for store domain '{{shop_domain_e.g._store.myshopify.com}}' over the past {{timeframe_days_e.g._30}} days. Synthesize gross revenue, Average Order Value (AOV), fulfillment backlog ratio, and top product performers into an executive briefing."
            },
            {
                promptName: "Create Flash Sale Discount",
                userPrompt: "Execute a POST request to the 'price_rules.json' endpoint on '{{shop_domain_e.g._store.myshopify.com}}'. Create a Price Rule titled '{{discount_code_title_e.g._FLASH20}}' granting a {{percentage_e.g._20%}} discount on all products, valid from {{start_date}} to {{end_date}}."
            },
            {
                promptName: "Inventory Restock & Audit",
                userPrompt: "Execute a GET action to the 'inventory_levels.json' endpoint on '{{shop_domain}}'. Identify all inventory items where available stock is below {{low_stock_threshold_e.g._10}} units, and generate a structured reorder list for supplier procurement."
            },
            {
                promptName: "Unfulfilled Order Audit & Processing",
                userPrompt: "Query the 'orders.json' endpoint on '{{shop_domain}}' with queryParams '{{query_params_e.g._status:open,fulfillment_status:unfulfilled}}'. Group stagnant unfulfilled orders by age, flag items delayed by more than {{delay_days_e.g._3}} days, and synthesize a resolution strategy."
            },
            {
                promptName: "Automated Webhook Security Provisioning",
                userPrompt: "Provision real-time event notifications on '{{shop_domain}}'. Execute a POST request to 'webhooks.json' to register a webhook listening to topic '{{topic_e.g._orders/create}}' and routing payloads securely to endpoint '{{webhook_callback_url}}'."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "slack_collaboration_agent",
        publicName: "Slack Communications Liaison",
        systemPrompt: "You are an enterprise communications liaison. Read channel histories to establish context before responding. When posting messages, format them cleanly using standard Slack markdown (e.g., *bold*, _italics_) and ensure actionable threading.",
        userPrompts: [
            {
                promptName: "Daily Standup Summary",
                userPrompt: "Review the message history in the {{channel_id_e.g._#engineering}} Slack channel for the past {{time_window_e.g._24_hours}}. Synthesize the core blockers and shipped features, then post a cleanly formatted markdown summary back to the channel."
            },
            {
                promptName: "Incident War Room Triage",
                userPrompt: "Review the message history in the {{channel_id_e.g._#inc-database-outage}} Slack channel for the past {{time_window_e.g._2_hours}}. Extract critical technical findings and post a synthesized timeline of events."
            },
            {
                promptName: "Automated Thread Follow-up",
                userPrompt: "Review the message history in {{channel_id_e.g._#support}} for the past {{timeframe_e.g._48_hours}}. Identify user questions that have zero replies in their thread, and post a message tagging the {{on_call_group_e.g._@support-team}} to investigate."
            },
            {
                promptName: "Feedback Extraction & Routing",
                userPrompt: "Read the recent history of {{channel_id_e.g._#customer-feedback}}. Extract all feature requests, categorize them by product area, and post a structured weekly digest to the {{target_channel_e.g._#product-managers}} channel."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "LOW_COMPUTE"
    },
    {
        toolName: "snowflake_data_agent",
        publicName: "Snowflake Data Engineer",
        systemPrompt: "You are an elite Data Engineer operating on Snowflake. Write highly optimized, standard SQL. Always qualify table names ({{database}}.{{schemaName}}). Use LIMIT clauses for exploratory queries. Never execute DROP or TRUNCATE operations without explicit user confirmation. Analyze result sets thoroughly.",
        userPrompts: [
            {
                promptName: "Cohort Analysis Pipeline",
                userPrompt: "Run optimized SQL on Snowflake '{{database_name_e.g._PROD_DB}}' and '{{schema_name_e.g._ANALYTICS_SCHEMA}}' to pull monthly recurring revenue by cohort. Analyze the returned dataset and summarize the retention trends for the executive team."
            },
            {
                promptName: "Cost Optimization Query",
                userPrompt: "Run optimized SQL on Snowflake '{{database_name}}' and '{{schema_name}}' to query the query_history view. Identify the top {{limit_e.g._10}} most expensive queries executed by the {{role_name}} role in the last 24 hours and suggest optimization strategies."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "uipath_orchestrator_agent",
        publicName: "UiPath Orchestrator Agent",
        systemPrompt: "You are an autonomous RPA operations manager. Use GET_RELEASES to verify the target process ID exists before dispatching jobs. If diagnosing queue items, pull job logs to trace the specific selector or application failure before attempting a restart.",
        userPrompts: [
            {
                promptName: "Trigger RPA Workflow",
                userPrompt: "Verify the release key for the UiPath process '{{process_name_e.g._InvoiceProcessing_Bot}}'. Once confirmed, trigger a new START_JOB passing the required JSON input arguments: {{json_arguments}}, and monitor the queue for failures."
            },
            {
                promptName: "Queue Management",
                userPrompt: "Execute GET_QUEUE_ITEMS for the UiPath queue '{{queue_name_e.g._Invoice_Queue}}' filtering by '{{status_e.g._Failed}}'. Extract the specific application exception messages from the items to determine if a targeted STOP_JOB and START_JOB restart is required."
            },
            {
                promptName: "Stuck Job Remediation",
                userPrompt: "Execute GET_JOBS to find jobs for process '{{process_name}}' stuck in a '{{state_e.g._Running}}' state for over 2 hours. Execute STOP_JOB on them, and trigger a fresh START_JOB with the original parameters."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "vrbo_property_agent",
        publicName: "Vrbo Property Agent",
        systemPrompt: "You are a Vrbo property management assistant. Always execute GET_AVAILABILITY first to audit the property calendar. Only after verifying the dates should you propose or execute updates to rates or booking statuses.",
        userPrompts: [
            {
                promptName: "Dynamic Pricing Adjustment",
                userPrompt: "Audit the GET_AVAILABILITY calendar for Vrbo Property '{{property_id}}' for the dates {{date_range}}. Identify low occupancy weeks and formulate an UPDATE_RATES payload to apply a strategic {{discount_e.g._10%_discount}}."
            },
            {
                promptName: "Competitor Analysis & Booking",
                userPrompt: "Retrieve the {{date_range}} availability for Vrbo Property '{{property_id}}'. If the property has more than {{vacancy_threshold_e.g._5_days}} of vacancy, formulate an UPDATE_RATES payload to reduce the minimum stay requirement to drive bookings."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    },
    {
        toolName: "yardi_virtuoso_agent",
        publicName: "Yardi Virtuoso Agent",
        systemPrompt: "You are a Yardi Property Management AI interacting via an MCP wrapper. Step 1: ALWAYS execute LIST_YARDI_TOOLS to retrieve current API capabilities and required schemas. Step 2: Use the exact schema discovered to build your payload. Step 3: Execute CALL_YARDI_TOOL.",
        userPrompts: [
            {
                promptName: "Resident Ledger Audit",
                userPrompt: "Initialize connection to the Yardi MCP. Run LIST_YARDI_TOOLS to discover the ledger query schema. Build the exact payload required and execute a CALL_YARDI_TOOL to fetch the ledger for resident '{{resident_name_or_id}}'."
            },
            {
                promptName: "Work Order Dispatch",
                userPrompt: "Initialize connection to the Yardi MCP. Run LIST_YARDI_TOOLS to identify the work order creation schema. Build the exact payload for a {{maintenance_issue_e.g._plumbing_leak}} at unit {{unit_number}}, and execute CALL_YARDI_TOOL to dispatch maintenance."
            },
            {
                promptName: "Automated Lease Renewal Generation",
                userPrompt: "Initialize connection to the Yardi MCP and run LIST_YARDI_TOOLS to find the lease management schema. Fetch all leases in property '{{property_code_e.g._OAK_WOODS}}' expiring within {{timeframe_e.g._90_days}}, and execute CALL_YARDI_TOOL to generate draft renewal offers with a {{rent_increase_e.g._5%}} increase."
            },
            {
                promptName: "Vendor Invoice Reconciliation",
                userPrompt: "Initialize connection to the Yardi MCP and run LIST_YARDI_TOOLS to discover the accounts payable schema. Fetch pending vendor invoices for property '{{property_code}}', cross-reference them against completed work orders for {{vendor_name}}, and execute CALL_YARDI_TOOL to approve matching invoices for payment."
            },
            {
                promptName: "Move-In Financial Reconciliation",
                userPrompt: "Run LIST_YARDI_TOOLS to find the ledger lookup schema. Execute CALL_YARDI_TOOL to fetch the ledger for new move-in '{{resident_name}}'. Verify that the security deposit and first month's rent are fully posted, and flag any missing balances."
            },
            {
                promptName: "Preventative Maintenance Auto-Scheduling",
                userPrompt: "Initialize connection to the Yardi MCP. Identify the work order schema. Dispatch preventative maintenance work orders for {{maintenance_task_e.g._HVAC_Filter_Replacement}} across all occupied units in property '{{property_code}}'."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "HIGH_COMPUTE"
    },
    {
        toolName: "zendesk_support_agent",
        publicName: "Zendesk Support Agent",
        systemPrompt: "You are a Tier 3 Customer Support triage agent. Sequence: (1) Use SEARCH_KB to determine if documentation already solves the issue. (2) If unresolved, search existing tickets to prevent duplicates. (3) Create or update the ticket. Ensure 'isPublic' is explicitly set to false for internal collaboration.",
        userPrompts: [
            {
                promptName: "Automated Ticket Triage",
                userPrompt: "Search Zendesk for open tickets concerning '{{issue_topic_e.g._login_failures}}'. Cross-reference with SEARCH_KB to find the SSO reset guide. For each ticket, apply an internal private note with the root cause, and auto-reply with the KB article link."
            },
            {
                promptName: "VIP Escalation Routing",
                userPrompt: "Search Zendesk for open tickets from the organization '{{organization_name_e.g._Acme_Corp}}'. For each ticket found, execute an UPDATE_TICKET action to tag it as 'VIP_Escalation' and add an internal note flagging it for the Customer Success Manager."
            }
        ],
        modelAvailability: "STANDARD_ONLY",
        costImpact: "MEDIUM_COMPUTE"
    }
];