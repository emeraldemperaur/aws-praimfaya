import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from 'aws-amplify/auth';
import '../styles/accountsettings.scss';
import BottomModal from './bottommodal'; 
import ExtraLargeModal from './extralargemodal'; 
import { NATIVE_TOOLS_TEMPLATES } from '../utils/prometheus'; 
import { getModelIcon } from '../utils/voltaire'; 
import { TIMEZONES } from '../utils/chronos';

const client = generateClient() as any;

interface AccountSettingsProps {
    searchQuery: string;
    darkMode: boolean;
}

export type IntegrationCredential = Record<string, string | boolean>;
export type IntegrationsMap = Record<string, IntegrationCredential[]>;

const TOOL_AUTH_MAP: Record<string, string[]> = {
    'airtable_data_agent': ['airtableApiKey'],
    'snowflake_data_agent': ['snowflakeAccount', 'snowflakeUser', 'snowflakePrivateKey'],
    'airflow_pipeline_agent': ['airflowBaseUrl'],
    'rippling_hr_agent': ['ripplingApiKey'],
    'bamboohr_agent': ['bambooSubdomain', 'bambooApiKey'],
    'zendesk_support_agent': ['zendeskSubdomain', 'zendeskEmail', 'zendeskToken'],
    'servicenow_itsm_agent': ['serviceNowInstance', 'serviceNowUser', 'serviceNowPassword'],
    'pagerduty_sre_agent': ['pagerDutyApiKey', 'pagerDutyUserEmail'],
    'github_developer_agent': ['githubToken'],
    'gitlab_developer_agent': ['gitlabDomain', 'gitlabToken'],
    'grafana_observability_agent': ['grafanaUrl', 'grafanaToken'],
    'datadog_monitoring_agent': ['datadogSite', 'datadogApiKey', 'datadogAppKey'],
    'butterflymx_access_agent': ['butterflyMxToken'],
    'yardi_virtuoso_agent': ['yardiToken', 'yardiPropertyId'],
    'salesforce_crm_agent': ['salesforceInstanceUrl', 'salesforceAccessToken'],
    'sap_erp_agent': ['sapBaseUrl', 'sapUsername', 'sapPassword'],
    'dynamics_365_agent': ['dynamicsInstanceUrl', 'dynamicsAccessToken'],
    'hubspot_crm_agent': ['hubspotAccessToken'],
    'linkedin_sales_agent': ['linkedInAccessToken'],
    'uipath_orchestrator_agent': ['uipathOrchestratorUrl', 'uipathOrganizationName', 'uipathTenantName', 'uipathAccessToken', 'uipathFolderId'],
    'booking_com_agent': ['bookingAffiliateId', 'bookingToken'],
    'priceline_partner_agent': ['pricelineApiKey'],
    'vrbo_property_agent': ['vrboPartnerId', 'vrboApiKey'],
    'byo_mcp_agent': ['mcpBaseUrl', 'mcpToken'],
    'alphabet_home_agent': ['googleHomeProjectId', 'googleHomeToken'],
    'alexa_agent': ['alexaToken'],
    'arduino_iot_agent': ['arduinoClientId', 'arduinoClientSecret'],
    'home_assistant_agent': ['homeAssistantUrl', 'homeAssistantToken'],
    'raspberry_pi_fleet_agent': ['balenaToken'],
    'amadeus_gds_agent': ['amadeusApiKey', 'amadeusApiSecret'],
    'confluence_wiki_agent': ['atlassianDomain', 'atlassianEmail', 'atlassianToken'],
    'notion_workspace_agent': ['notionToken'],
    'asana_pm_agent': ['asanaToken'],
    'google_workspace_agent': ['googleAccessToken'],
    'slack_collaboration_agent': ['slackToken'],
    'contentful_cms_agent': ['contentfulSpaceId', 'contentfulEnvironment', 'contentfulToken'],
    'sanity_cms_agent': ['sanityProjectId', 'sanityDataset', 'sanityToken'],
    'formstack_agile_agent': ['formstackToken'],
    'jotform_agile_agent': ['jotformToken'],
    'shopify_admin_agent': ['shopifyDomain', 'shopifyAccessToken'],
    'etrade_financial_agent': ['etradeConsumerKey', 'etradeConsumerSecret', 'etradeAccessToken', 'etradeAccessSecret', 'etradeEnvironment'],
};

const SecretInput: React.FC<{ placeholder: string; value: string; onChange: (v: string) => void; required?: boolean; darkMode?: boolean; autoComplete?: string }> = ({ placeholder, value, onChange, required, autoComplete = "off" }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="as-secret-input-wrapper" style={{ position: 'relative', width: '100%' }}>
            <input
                type={show ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                required={required}
                autoComplete={autoComplete}
                className="as-input"
                style={{ paddingRight: '2.5rem', width: '100%', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShow(!show)} className="as-visibility-toggle" tabIndex={-1} title={show ? "Hide credential" : "Show credential"}>
                <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
        </div>
    );
};

const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const AccountSettings: React.FC<AccountSettingsProps> = ({ searchQuery, darkMode }) => {
    const [profileId, setProfileId] = useState<string | null>(null);
    const [cognitoUserId, setCognitoUserId] = useState<string | null>(null);
    const [profile, setProfile] = useState({
        firstName: '',
        lastName: '',
        email: '',
        timeZone: 'America/Vancouver',
        mcpDiscovery: false,
        nocturnalAgents: false
    });

    const [integrations, setIntegrations] = useState<IntegrationsMap>({});

    const [isBottomModalOpen, setIsBottomModalOpen] = useState(false);
    const [selectedToolForAdd, setSelectedToolForAdd] = useState<string>('');
    const [newCredential, setNewCredential] = useState<Record<string, string>>({});

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingToolId, setEditingToolId] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const user = await getCurrentUser();
                setCognitoUserId(user.userId);
                const { data: profiles } = await client.models.UserProfile.list({
                    filter: { cognitoUserId: { eq: user.userId } }
                });

                if (profiles && profiles.length > 0) {
                    const dbProfile = profiles[0];
                    setProfileId(dbProfile.id);
                    
                    setProfile({
                        firstName: dbProfile.firstName || '',
                        lastName: dbProfile.lastName || '',
                        email: user.signInDetails?.loginId || dbProfile.email || 'user@vanguard.io',
                        timeZone: dbProfile.timeZone || 'America/Vancouver',
                        mcpDiscovery: dbProfile.mcpDiscovery ?? false,
                        nocturnalAgents: dbProfile.nocturnalAgents ?? false
                    });

                    const dbIntegrations = typeof dbProfile.integrations === 'string' 
                        ? JSON.parse(dbProfile.integrations) 
                        : (dbProfile.integrations || {});
                    setIntegrations(dbIntegrations);
                }
            } catch (error) {
                console.error("Failed to load user profile: ", error);
            }
        };

        fetchUserProfile();
    }, []);

    const availableTools = NATIVE_TOOLS_TEMPLATES.filter(t => TOOL_AUTH_MAP[t.toolName]);

    const filteredIntegrations = Object.entries(integrations).filter(([toolName]) => {
        const template = availableTools.find(t => t.toolName === toolName);
        return template?.publicName.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === '';
    });

    const handleSaveProfile = async () => {
        try {
            if (profileId) {
                await client.models.UserProfile.update({
                    id: profileId,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    timeZone: profile.timeZone,
                    mcpDiscovery: profile.mcpDiscovery,
                    nocturnalAgents: profile.nocturnalAgents
                });
            } else if (cognitoUserId) {
                const response = await client.models.UserProfile.create({
                    cognitoUserId: cognitoUserId,
                    email: profile.email,
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    timeZone: profile.timeZone,
                    mcpDiscovery: profile.mcpDiscovery,
                    nocturnalAgents: profile.nocturnalAgents
                });
                setProfileId(response.data.id);
            }
            alert('Account Profile saved successfully.');
        } catch (error) {
            console.error("Failed to update profile: ", error);
            alert('Failed to save profile. Please try again.');
        }
    };

    const saveIntegrationsToDB = async (updatedIntegrations: IntegrationsMap) => {
        try {
            const payload = JSON.stringify(updatedIntegrations); 

            if (profileId) {
                await client.models.UserProfile.update({
                    id: profileId,
                    integrations: payload
                });
            } else if (cognitoUserId) {
                const response = await client.models.UserProfile.create({
                    cognitoUserId: cognitoUserId,
                    email: profile.email,
                    timeZone: profile.timeZone,
                    mcpDiscovery: profile.mcpDiscovery,
                    nocturnalAgents: profile.nocturnalAgents,
                    integrations: payload
                });
                setProfileId(response.data.id);
            }
        } catch (error) {
            console.error("Failed to save integrations: ", error);
        }
    };

    const handleAddCredentialSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!selectedToolForAdd || Object.keys(newCredential).length === 0) return;

        const existing = integrations[selectedToolForAdd] || [];
        const toAdd = { ...newCredential, priority: existing.length === 0 };
        const updatedIntegrations = { ...integrations, [selectedToolForAdd]: [...existing, toAdd] };

        setIntegrations(updatedIntegrations);
        await saveIntegrationsToDB(updatedIntegrations);

        setIsBottomModalOpen(false);
        setNewCredential({});
        setSelectedToolForAdd('');
    };

    const handleDeleteCredential = async (toolId: string, index: number) => {
        const updated = [...integrations[toolId]];
        updated.splice(index, 1);
        
        if (updated.length > 0 && !updated.some(c => c.priority)) {
            updated[0].priority = true; 
        }

        let newIntegrations = { ...integrations };
        if (updated.length === 0) {
            delete newIntegrations[toolId];
            if (editingToolId === toolId) setIsEditModalOpen(false);
        } else {
            newIntegrations[toolId] = updated;
        }

        setIntegrations(newIntegrations);
        await saveIntegrationsToDB(newIntegrations);
    };

    const handleSetPriority = (toolId: string, index: number) => {
        setIntegrations(prev => {
            const updated = prev[toolId].map((c, i) => ({ ...c, priority: i === index }));
            return { ...prev, [toolId]: updated };
        });
    };

    const handleEditCredentialField = (toolId: string, index: number, field: string, val: string) => {
        setIntegrations(prev => {
            const updated = [...prev[toolId]];
            updated[index] = { ...updated[index], [field]: val };
            return { ...prev, [toolId]: updated };
        });
    };

    const fallbackName = profile.email ? profile.email.split('@')[0] : '';
    const displayName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || fallbackName;
    const userInitials = getInitials(displayName);

    return (
        <div className="account-settings-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', boxSizing: 'border-box' }}>
            
            <style dangerouslySetInnerHTML={{__html: `
                .account-settings-wrapper .as-input:focus,
                .account-settings-wrapper .as-input:focus-visible,
                .account-settings-wrapper .as-input:active {
                    outline: 2px solid #0B0B45 !important;
                    outline-offset: -1px !important;
                    border-color: #0B0B45 !important;
                    box-shadow: none !important;
                    -webkit-box-shadow: none !important;
                }
                
                ${darkMode ? `
                .account-settings-wrapper .as-btn-primary,
                .account-settings-wrapper .as-btn-icon-large {
                    background-color: #ffffff !important;
                    color: #0B0B45 !important;
                }
                .account-settings-wrapper .as-switch input:checked + .as-slider {
                    background-color: #ffffff !important;
                }
                .account-settings-wrapper .as-switch input:checked + .as-slider:before {
                    background-color: #0B0B45 !important;
                }
                ` : `
                .account-settings-wrapper .as-btn-primary,
                .account-settings-wrapper .as-btn-icon-large {
                    background-color: #0B0B45 !important;
                    color: #ffffff !important;
                }
                .account-settings-wrapper .as-switch input:checked + .as-slider {
                    background-color: #0B0B45 !important;
                }
                .account-settings-wrapper .as-switch input:checked + .as-slider:before {
                    background-color: #ffffff !important;
                }
                `}
            `}} />

            <div className="ft-card as-profile-card" style={{ width: '100%', boxSizing: 'border-box' }}>
                <div className="as-section-header">
                    <h3>Account Profile</h3>
                </div>
                
                <div className="as-profile-content-grid" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: '3rem', width: '100%', boxSizing: 'border-box' }}>
                    
                    <div className="as-profile-form" style={{ flex: '0 0 450px', width: '450px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="as-input-group">
                            <label>First Name</label>
                            <input type="text" className="as-input" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="as-input-group">
                            <label>Last Name</label>
                            <input type="text" className="as-input" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="as-input-group">
                            <label>Email Address <span className="as-badge-readonly">Immutable</span></label>
                            <input type="email" className="as-input disabled" value={profile.email} disabled style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        
                        <div className="as-input-group">
                            <label>Time Zone</label>
                            <select 
                                className="as-input" 
                                value={profile.timeZone} 
                                onChange={e => setProfile({...profile, timeZone: e.target.value})} 
                                style={{ width: '100%', boxSizing: 'border-box' }}
                            >
                                {TIMEZONES.map((tz) => (
                                    <option key={tz.tzIdentifier} value={tz.tzIdentifier}>
                                        {tz.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="as-toggles" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
                            <div className="as-toggle-row">
                                <div>
                                    <span className="as-toggle-label">Enable Prometheus MCP Discovery</span>
                                    <span className="as-toggle-sub" style={{ fontFamily: 'Google Sans Code' }}>Allow remote MCP to access account context resources.</span>
                                </div>
                                <label className="as-switch">
                                    <input type="checkbox" checked={profile.mcpDiscovery} onChange={e => setProfile({...profile, mcpDiscovery: e.target.checked})} />
                                    <span className="as-slider"></span>
                                </label>
                            </div>
                            <div className="as-toggle-row">
                                <div>
                                    <span className="as-toggle-label">Enable Nocturnal Agents</span>
                                    <span className="as-toggle-sub" style={{ fontFamily: 'Google Sans Code' }}>Allow supervisor agents to execute workflows off-hours.</span>
                                </div>
                                <label className="as-switch">
                                    <input type="checkbox" checked={profile.nocturnalAgents} onChange={e => setProfile({...profile, nocturnalAgents: e.target.checked})} />
                                    <span className="as-slider"></span>
                                </label>
                            </div>
                        </div>

                        <button className="as-btn-primary" onClick={handleSaveProfile} style={{ width: '100%', maxWidth: '240px', marginTop: '1rem', fontFamily: 'Bodoni Moda Variable, serif', fontWeight: 600, letterSpacing: '0.05em'}}>
                            Save Changes
                        </button>
                    </div>

                    <div className="as-avatar-section" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', minWidth: '200px' }}>
                        <div 
                            className="profile-avatar-circle"
                            style={{
                                width: '130px',
                                height: '130px',
                                borderRadius: '50%',
                                backgroundColor: '#800020',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.75rem',
                                fontWeight: 'bold',
                                fontFamily: 'Bodoni Moda Variable, serif',
                                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
                                flexShrink: 0
                            }}
                        >
                            {userInitials}
                        </div>
                        <span className="profile-avatar-role" style={{ marginTop: '0.85rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted, #6b7280)', fontFamily: 'Google Sans Code, monospace' }}>
                            Cognito User
                        </span>
                    </div>

                </div>
            </div>

            <div className="as-integrations-section">
                <div className="as-integrations-header">
                    <h2>Integration Credentials</h2>
                    <button className="as-btn-icon-large pulse" onClick={() => setIsBottomModalOpen(true)} title="Add Integration" style={{ backgroundColor: '#0B0B45', boxShadow: '0 4px 12px rgba(47, 48, 48, 0.4)', marginBottom: '0.00rem' }}>
                        <i className="bx bx-plus"></i>
                    </button>
                </div>

                <div className="as-integrations-grid">
                    {filteredIntegrations.map(([toolId, creds]) => {
                        const template = availableTools.find(t => t.toolName === toolId);
                        if (!template) return null;

                        return (
                            <div className="ft-card as-integration-card" key={toolId}>
                                <div className="card-body">
                                    <div className="icon-wrapper" style={{ color: '#0B0B45' }}>
                                        <img 
                                            src={getModelIcon(toolId)} 
                                            alt={template.publicName} 
                                            style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
                                        />
                                    </div>
                                    <h4>{template.publicName}</h4>
                                    <span className="cred-count">{creds.length} {creds.length === 1 ? 'Credential' : 'Credentials'}</span>
                                </div>
                                <div className="card-footer">
                                    <button className="as-icon-btn" onClick={() => { setEditingToolId(toolId); setIsEditModalOpen(true); }}><i className="bx bx-cog"></i></button>
                                    <button className="as-icon-btn danger" onClick={() => handleDeleteCredential(toolId, 0)}><i className="bx bx-trash"></i></button>
                                </div>
                            </div>
                        );
                    })}
                    {filteredIntegrations.length === 0 && (
                        <div className="as-no-data" style={{ padding: '2rem 0', fontWeight: 500, textAlign: 'center', fontFamily: 'Google Sans Code' }}>
                            {Object.keys(integrations).length === 0 
                                ? 'No Integrations found' 
                                : 'No integrations matching search.'}
                        </div>
                    )}
                </div>
            </div>

            {createPortal(
                <BottomModal isOpen={isBottomModalOpen} onClose={() => { setIsBottomModalOpen(false); setSelectedToolForAdd(''); setNewCredential({}); }} darkMode={darkMode} title="Add Integration Credential">
                    <div id="vanguard-account-settings" className={`account-settings-wrapper ${darkMode ? 'dark-theme' : ''}`} style={{ gap: 0, padding: 0, width: '100%', boxSizing: 'border-box' }}>
                        <form onSubmit={handleAddCredentialSubmit} className="as-modal-form" style={{ width: '100%', boxSizing: 'border-box' }}>
                            <div className="as-input-group" style={{ width: '100%', boxSizing: 'border-box' }}>
                                <label>Select Integration Tool</label>
                                <select className="as-input" value={selectedToolForAdd} onChange={e => { setSelectedToolForAdd(e.target.value); setNewCredential({}); }} required style={{ width: '100%', boxSizing: 'border-box' }}>
                                    <option value="" disabled>Select a tool...</option>
                                    {availableTools.map(t => (
                                        <option key={t.toolName} value={t.toolName}>{t.publicName}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedToolForAdd && TOOL_AUTH_MAP[selectedToolForAdd] && (
                                <div className="as-dynamic-fields" style={{ width: '100%', boxSizing: 'border-box' }}>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                                        <div className="icon-wrapper" style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(11, 11, 69, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img src={getModelIcon(selectedToolForAdd)} alt="Integration Icon" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                                        </div>
                                        <h3 style={{ margin: 0, fontFamily: "'Bodoni Moda Variable', serif", fontSize: '1.25rem' }}>
                                            {availableTools.find(t => t.toolName === selectedToolForAdd)?.publicName}
                                        </h3>
                                    </div>

                                    {TOOL_AUTH_MAP[selectedToolForAdd].map(field => (
                                        <div className="as-input-group" key={field} style={{ width: '100%', boxSizing: 'border-box' }}>
                                            <label>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                            {field.toLowerCase().includes('token') || field.toLowerCase().includes('secret') || field.toLowerCase().includes('password') || field.toLowerCase().includes('key') ? (
                                                <SecretInput 
                                                    placeholder={`Enter ${field}`} 
                                                    value={newCredential[field] || ''} 
                                                    onChange={(val) => setNewCredential({...newCredential, [field]: val})} 
                                                    required 
                                                    autoComplete="new-password"
                                                />
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    className="as-input" 
                                                    placeholder={`Enter ${field}`} 
                                                    value={newCredential[field] || ''} 
                                                    onChange={(e) => setNewCredential({...newCredential, [field]: e.target.value})} 
                                                    required 
                                                    autoComplete="off"
                                                    data-1p-ignore
                                                    data-lpignore="true"
                                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="submit" className="as-btn-primary" style={{ maxWidth: '200px' }}>Save Credential</button>
                            </div>
                        </form>
                    </div>
                </BottomModal>,
                document.body
            )}

            {createPortal(
                <ExtraLargeModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingToolId(null); }} darkMode={darkMode} title="Manage Integration Credentials">
                    <div id="vanguard-account-settings" className={`account-settings-wrapper ${darkMode ? 'dark-theme' : ''}`} style={{ gap: 0, padding: 0, width: '100%', boxSizing: 'border-box' }}>
                        {editingToolId && integrations[editingToolId] && (
                            <div className="as-edit-wrapper" style={{ width: '100%', boxSizing: 'border-box' }}>
                                <div className="as-edit-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div className="icon-wrapper" style={{ color: '#0B0B45' }}>
                                        <img 
                                            src={getModelIcon(editingToolId)} 
                                            alt="Integration Icon" 
                                            style={{ width: '28px', height: '28px', objectFit: 'contain' }} 
                                        />
                                    </div>
                                    <h2 style={{ margin: 0, fontFamily: "'Bodoni Moda Variable', serif", fontSize: '1.5rem' }}>
                                        {availableTools.find(t => t.toolName === editingToolId)?.publicName}
                                    </h2>
                                </div>

                                <div className="as-credentials-list" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
                                    {integrations[editingToolId].map((cred, idx) => (
                                        <div className="as-credential-row" key={idx} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', width: '100%', boxSizing: 'border-box' }}>
                                            <div className="as-cred-radio" style={{ flexShrink: 0 }}>
                                                <label className="as-radio-label">
                                                    <input type="radio" name={`priority-${editingToolId}`} checked={!!cred.priority} onChange={() => handleSetPriority(editingToolId, idx)} />
                                                    <span>Primary</span>
                                                </label>
                                            </div>
                                            <div className="as-cred-fields" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box' }}>
                                                {TOOL_AUTH_MAP[editingToolId].map(field => (
                                                    <div className="as-input-group" key={field} style={{ width: '100%', boxSizing: 'border-box' }}>
                                                        <label>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                                        {field.toLowerCase().includes('token') || field.toLowerCase().includes('secret') || field.toLowerCase().includes('password') || field.toLowerCase().includes('key') ? (
                                                            <SecretInput 
                                                                placeholder={`Enter ${field}`} 
                                                                value={(cred[field] as string) || ''} 
                                                                onChange={(val) => handleEditCredentialField(editingToolId, idx, field, val)} 
                                                                autoComplete="new-password"
                                                            />
                                                        ) : (
                                                            <input 
                                                                type="text" 
                                                                className="as-input" 
                                                                value={(cred[field] as string) || ''} 
                                                                onChange={e => handleEditCredentialField(editingToolId, idx, field, e.target.value)} 
                                                                autoComplete="off"
                                                                data-1p-ignore
                                                                data-lpignore="true"
                                                                style={{ width: '100%', boxSizing: 'border-box' }}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <button className="as-icon-btn danger" onClick={() => handleDeleteCredential(editingToolId, idx)} title="Delete Credential" style={{ flexShrink: 0 }}>
                                                <i className="bx bx-trash"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                    <button className="as-btn-outline" style={{ background: 'transparent', border: '1px solid #0B0B45', color: '#0B0B45', padding: '0.75rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                                        setIntegrations(prev => {
                                            const updated = [...prev[editingToolId as string]];
                                            updated.push({ priority: false });
                                            return { ...prev, [editingToolId as string]: updated };
                                        });
                                    }}>
                                        <i className="bx bx-plus"></i> Add Another Credential
                                    </button>
                                    
                                    <button className="as-btn-primary" style={{ maxWidth: '200px', margin: 0, fontFamily: 'Bodoni Moda Variable, serif', fontWeight: 600 }} onClick={() => {
                                        saveIntegrationsToDB(integrations);
                                        setIsEditModalOpen(false);
                                    }}>
                                        Save Credentials
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </ExtraLargeModal>,
                document.body
            )}

        </div>
    );
};

export default AccountSettings;