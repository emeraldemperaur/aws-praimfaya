import React, { useState } from 'react';
import type { EphemeralSecrets } from '../data/consoleterminal';

interface EphemeralCredentialsModalProps {
  darkMode?: boolean;
  activeAuthPrompt: string;
  ephemeralSecrets: EphemeralSecrets;
  setEphemeralSecrets: React.Dispatch<React.SetStateAction<EphemeralSecrets>>;
  onSubmit: (e: React.SyntheticEvent) => void;
  onCancel: () => void;
}

const SecretInput: React.FC<{
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  style: React.CSSProperties;
  darkMode: boolean;
}> = ({ placeholder, onChange, required, style, darkMode }) => {
  const [show, setShow] = useState(false);
  
  const { marginBottom, ...restStyle } = style as any;

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: marginBottom || '0.75rem' }}>
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        onChange={onChange}
        required={required}
        style={{ ...restStyle, paddingRight: '2.5rem', marginBottom: 0, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        tabIndex={-1}
        title={show ? "Hide credential" : "Show credential"}
        style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: darkMode ? '#9ca3af' : '#6b7280',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
      </button>
    </div>
  );
};

const EphemeralCredentialsModal: React.FC<EphemeralCredentialsModalProps> = ({
  darkMode = false,
  activeAuthPrompt,
  ephemeralSecrets,
  setEphemeralSecrets,
  onSubmit,
  onCancel
}) => {
  
  const inputStyle = {
    width: '100%',
    backgroundColor: darkMode ? '#1f2937' : '#f3f4f6',
    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
    borderRadius: '4px',
    padding: '0.65rem',
    fontSize: '0.85rem',
    color: darkMode ? '#f9fafb' : '#111827',
    marginBottom: '0.75rem',
    boxSizing: 'border-box' as const,
    fontFamily: 'Google Sans Code, monospace'
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: darkMode ? '#111827' : '#ffffff',
        border: `1px solid ${darkMode ? '#0891b2' : '#06b6d4'}`,
        borderRadius: '0.75rem', padding: '2rem', maxWidth: '32rem', width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: darkMode ? '#f9fafb' : '#111827',
        fontFamily: 'Google Sans Code, monospace',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: darkMode ? '#22d3ee' : '#0891b2' }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '1.25rem' }}></i>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Authentication Required
          </h3>
        </div>
        
        <p style={{ fontSize: '0.8rem', color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Action requires dynamic credentials for <strong style={{ color: darkMode ? '#67e8f9' : '#0891b2', textTransform: 'uppercase' }}>{activeAuthPrompt}</strong>. 
          Credentials are stored securely in ephemeral browser memory and clear upon refresh.
        </p>

        <form onSubmit={onSubmit}>
          
          {activeAuthPrompt === 'airtable' && (
            <SecretInput placeholder="Airtable API Key / PAT" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, airtableApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'snowflake' && (
            <>
              <input type="text" placeholder="Account Identifier (e.g. xy12345.us-east-1)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, snowflakeAccount: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Username" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, snowflakeUser: e.target.value })} required style={inputStyle} />
              <textarea placeholder="RSA Private Key (PEM format)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, snowflakePrivateKey: e.target.value })} required style={{...inputStyle, height: '100px', resize: 'none'}} />
            </>
          )}

          {activeAuthPrompt === 'airflow' && (
            <input type="url" placeholder="Airflow Webserver Base URL" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, airflowBaseUrl: e.target.value })} required style={inputStyle} />
          )}

          {activeAuthPrompt === 'rippling' && (
            <SecretInput placeholder="Rippling Platform Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, ripplingApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'bamboohr' && (
            <>
              <input type="text" placeholder="Subdomain (e.g. mycompany)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bambooSubdomain: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bambooApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'zendesk' && (
            <>
              <input type="text" placeholder="Subdomain" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, zendeskSubdomain: e.target.value })} required style={inputStyle} />
              <input type="email" placeholder="Admin Email" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, zendeskEmail: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, zendeskToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'servicenow' && (
            <>
              <input type="text" placeholder="Instance Name (e.g. dev12345)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, serviceNowInstance: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Username" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, serviceNowUser: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Password" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, serviceNowPassword: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'pagerduty' && (
            <>
              <SecretInput placeholder="API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, pagerDutyApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
              <input type="email" placeholder="User Email (Required for incident updates)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, pagerDutyUserEmail: e.target.value })} required style={inputStyle} />
            </>
          )}

          {activeAuthPrompt === 'github' && (
            <SecretInput placeholder="GitHub Personal Access Token (Fine-grained or Classic)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, githubToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'gitlab' && (
            <>
              <input type="text" placeholder="GitLab Domain (Optional, defaults to gitlab.com)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, gitlabDomain: e.target.value })} style={inputStyle} />
              <SecretInput placeholder="GitLab Personal Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, gitlabToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'grafana' && (
            <>
              <input type="url" placeholder="Grafana Instance URL (e.g., https://myorg.grafana.net)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, grafanaUrl: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Grafana Cloud API Token / Service Account Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, grafanaToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'datadog' && (
            <>
              <input type="text" placeholder="Datadog Site (Optional, defaults to datadoghq.com)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, datadogSite: e.target.value })} style={inputStyle} />
              <SecretInput placeholder="Datadog API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, datadogApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
              <SecretInput placeholder="Datadog Application Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, datadogAppKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'butterflymx' && (
            <SecretInput placeholder="ButterflyMX API Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, butterflyMxToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'yardi' && (
            <>
              <SecretInput placeholder="Yardi Virtuoso MCP Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, yardiToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
              <input type="text" placeholder="Yardi Property ID (Optional, for property-specific scoping)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, yardiPropertyId: e.target.value })} style={inputStyle} />
            </>
          )}

          {activeAuthPrompt === 'salesforce' && (
            <>
              <input type="url" placeholder="Salesforce Instance URL (e.g. https://your-domain.my.salesforce.com)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, salesforceInstanceUrl: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Salesforce OAuth / Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, salesforceAccessToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'sap' && (
            <>
              <input type="url" placeholder="SAP S/4HANA Base URL" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sapBaseUrl: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="SAP Username" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sapUsername: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="SAP Password" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sapPassword: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'dynamics' && (
            <>
              <input type="url" placeholder="Dynamics 365 Organization URL" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, dynamicsInstanceUrl: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Dynamics 365 Web API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, dynamicsAccessToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'hubspot' && (
            <SecretInput placeholder="HubSpot Private App Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, hubspotAccessToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'linkedin' && (
            <SecretInput placeholder="LinkedIn Sales Navigator Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, linkedInAccessToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'uipath' && (
            <>
              <input type="url" placeholder="UiPath Cloud URL (e.g. https://cloud.uipath.com)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathOrchestratorUrl: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Organization Name" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathOrganizationName: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Tenant Name" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathTenantName: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="UiPath OAuth / Bearer Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathAccessToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
              <input type="text" placeholder="Orchestrator Folder ID (Optional, defaults to 1)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, uipathFolderId: e.target.value })} style={inputStyle} />
            </>
          )}

          {activeAuthPrompt === 'booking' && (
            <>
              <input type="text" placeholder="Booking.com Affiliate ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bookingAffiliateId: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Booking.com API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, bookingToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'priceline' && (
            <SecretInput placeholder="Priceline Partner API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, pricelineApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'vrbo' && (
            <>
              <input type="text" placeholder="Expedia Group Partner ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, vrboPartnerId: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Vrbo / Rapid API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, vrboApiKey: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'mito' && (
            <SecretInput placeholder="Mito UI MCP API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, mitoToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'apotheosis' && (
            <SecretInput placeholder="Apotheosis UX MCP API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, apotheosisToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'google_home' && (
            <>
              <input type="text" placeholder="Google Cloud Project ID (SDM)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, googleHomeProjectId: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Google Home API / SDM Bearer Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, googleHomeToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'alexa' && (
            <SecretInput placeholder="Alexa Smart Home API Bearer Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, alexaToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'arduino' && (
            <>
              <input type="text" placeholder="Arduino API Client ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, arduinoClientId: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Arduino API Client Secret" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, arduinoClientSecret: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'home_assistant' && (
            <>
              <input type="url" placeholder="Home Assistant URL (e.g. http://homeassistant.local:8123)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, homeAssistantUrl: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Long-Lived Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, homeAssistantToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'balena' && (
            <SecretInput placeholder="BalenaCloud / Fleet Management Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, balenaToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'amadeus' && (
            <>
              <input type="text" placeholder="Amadeus API Key" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, amadeusApiKey: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Amadeus API Secret" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, amadeusApiSecret: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'atlassian' && (
            <>
              <input type="text" placeholder="Atlassian Domain (e.g., yourcompany)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, atlassianDomain: e.target.value })} required style={inputStyle} />
              <input type="email" placeholder="Atlassian Account Email" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, atlassianEmail: e.target.value })} required style={inputStyle} />
              <SecretInput placeholder="Atlassian API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, atlassianToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'notion' && (
            <SecretInput placeholder="Notion Internal Integration Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, notionToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'asana' && (
            <SecretInput placeholder="Asana Personal Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, asanaToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'google' && (
            <SecretInput placeholder="Google OAuth Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, googleAccessToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'slack' && (
            <SecretInput placeholder="Slack Bot / User OAuth Token (xoxb- or xoxp-)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, slackToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
          )}

          {activeAuthPrompt === 'contentful' && (
            <>
              <input type="text" placeholder="Contentful Space ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, contentfulSpaceId: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Environment (Optional, defaults to master)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, contentfulEnvironment: e.target.value })} style={inputStyle} />
              <SecretInput placeholder="Contentful Personal Access Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, contentfulToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'sanity' && (
            <>
              <input type="text" placeholder="Sanity Project ID" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sanityProjectId: e.target.value })} required style={inputStyle} />
              <input type="text" placeholder="Dataset (Optional, defaults to production)" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sanityDataset: e.target.value })} style={inputStyle} />
              <SecretInput placeholder="Sanity API Token" onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, sanityToken: e.target.value })} required style={inputStyle} darkMode={darkMode} />
            </>
          )}

          {activeAuthPrompt === 'formstack' && (
            <SecretInput 
              placeholder="Formstack API Bearer Token" 
              onChange={e => setEphemeralSecrets({ ...ephemeralSecrets, formstackToken: e.target.value })} 
              required 
              style={inputStyle} 
              darkMode={darkMode} 
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={onCancel}
              style={{ padding: '0.65rem 1rem', background: 'transparent', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              style={{ padding: '0.65rem 1.25rem', backgroundColor: '#0891b2', color: '#ffffff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Inject Credentials
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default EphemeralCredentialsModal;