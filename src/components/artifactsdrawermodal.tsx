import { useState } from 'react';
import DrawerModal from './drawermodal';
import type { Schema } from '../../amplify/data/resource';
import type { DeepTerminalSession } from '../pages/terminalsession'; 

interface ArtifactsDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
  session: DeepTerminalSession | null;
  artifacts: Schema['RAGArtifact']['type'][];
}

export const ArtifactsDrawerModal = ({ isOpen, onClose, darkMode = false, session, artifacts }: ArtifactsDrawerModalProps) => {
  const [artifactTab, setArtifactTab] = useState<'ALL' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('ALL');
  const filteredArtifacts = artifactTab === 'ALL' ? artifacts : artifacts.filter(a => a.fileType === artifactTab);

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTemperatureDescription = (temp?: number | null) => {
    if (temp === null || temp === undefined) return 'Controls LLM determinism vs. creativity.';
    if (temp <= 0.3) return 'Highly Deterministic';
    if (temp <= 0.7) return 'Balanced';
    return 'Highly Creative';
  };

  const hasActiveCapabilities = 
    session?.contextProfile?.enableCodeInterpreter || 
    session?.contextProfile?.enableWebSearch || 
    session?.contextProfile?.enableMitoMcp || 
    session?.contextProfile?.enableApotheosisMcp || 
    session?.contextProfile?.customMcpUrl;

  return (
    <DrawerModal
      isOpen={isOpen}
      onClose={onClose}
      icon={<i className="fa-solid fa-cubes" />}
      title={`${session?.title || 'Session'} Artifacts`}
      darkMode={darkMode}
      width="650px"
      height="100vh"
    >
      <style>
        {`
          .modal-tab {
            padding: 0.5rem 1rem;
            font-size: 0.8rem;
            font-family: 'Google Sans Code', monospace;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
          }
          .modal-tab.active {
            border-bottom-color: #2563eb;
            color: #2563eb;
            font-weight: 600;
          }
        `}
      </style>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', paddingRight: '0.5rem' }}>
        
        <div style={{ padding: '1.25rem', borderRadius: '8px', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>{session?.contextProfile?.name}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.85rem', lineHeight: 1.5 }}>
                <span>{session?.contextProfile?.description || session?.contextProfile?.systemPrompt?.substring(0, 100) + '...'}</span>
                {session?.contextProfile?.description && (
                  <i className="fa-solid fa-circle-info" title={session.contextProfile.systemPrompt || ''} style={{ cursor: 'help', color: '#2563eb' }}></i>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Temperature</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Bodoni Moda Variable' }}>{session?.contextProfile?.temperature || 0}&deg;</span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                {getTemperatureDescription(session?.contextProfile?.temperature)}
              </p>
            </div>

            <div>
               <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Active Capabilities</span>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {!hasActiveCapabilities ? (
                    <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic' }}>No native capabilities enabled.</span>
                  ) : (
                    <>
                      {session?.contextProfile?.enableCodeInterpreter && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#dbeafe', color: '#1d4ed8', borderRadius: '4px', fontWeight: 600 }}>Code Interpreter</span>}
                      {session?.contextProfile?.enableWebSearch && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: 600 }}>Web Search</span>}
                      {session?.contextProfile?.enableMitoMcp && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#fef08a', color: '#854d0e', borderRadius: '4px', fontWeight: 600 }}>Mito UI MCP</span>}
                      {session?.contextProfile?.enableApotheosisMcp && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#f3e8ff', color: '#6b21a8', borderRadius: '4px', fontWeight: 600 }}>Apotheosis UX MCP</span>}
                      {session?.contextProfile?.customMcpUrl && (
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontWeight: 600 }} title={session.contextProfile.customMcpUrl}>
                          BYOMCP {session.contextProfile.mcpRequiresAuth && <i className="fa-solid fa-lock" style={{marginLeft: '0.25rem'}}></i>}
                        </span>
                      )}
                    </>
                  )}
               </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', gap: '1rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, marginBottom: '1rem' }}>
            {(['ALL', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const).map(tab => (
              <div 
                key={tab} 
                className={`modal-tab ${artifactTab === tab ? 'active' : ''}`}
                style={{ color: artifactTab !== tab ? (darkMode ? '#9ca3af' : '#6b7280') : undefined }}
                onClick={() => setArtifactTab(tab)}
              >
                {tab}
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                <tr>
                  <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>Artifact Name</th>
                  <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredArtifacts.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>No artifacts generated in this session.</td>
                  </tr>
                ) : (
                  filteredArtifacts.map(art => (
                    <tr key={art.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                      <td style={{ padding: '0.75rem', color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Google Sans Code, monospace', fontSize: '0.75rem' }}>
                        <span style={{ display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={art.fileName}>
                          {art.fileName}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#d1d5db' : '#4b5563', borderRadius: '4px' }}>
                          {art.fileType}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.75rem' }}>
                         {new Date(art.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => downloadFile(art.fileUrl, art.fileName)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                        >
                          Download <i className="fa-solid fa-download"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DrawerModal>
  );
};