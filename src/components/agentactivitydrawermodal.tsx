import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import BottomRightModal from './bottomrightmodal';

const client = generateClient<Schema>();

interface AgentActivityDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  session: any;
}

export const AgentActivityDrawerModal: React.FC<AgentActivityDrawerModalProps> = ({ isOpen, onClose, darkMode, session }) => {
  const [activities, setActivities] = useState<Schema['AgentActivity']['type'][]>([]);
  const [isDeusExMachinaEnabled, setIsDeusExMachinaEnabled] = useState(session?.deusExMachina || false);
  const [isKilling, setIsKilling] = useState(false);
  const [isKillModalOpen, setIsKillModalOpen] = useState(false);
  const [isTogglingDeus, setIsTogglingDeus] = useState(false);

  useEffect(() => {
    setIsDeusExMachinaEnabled(session?.deusExMachina || false);
  }, [session?.deusExMachina]);

  useEffect(() => {
    if (!isOpen || !session?.id) return;

    const sub = client.models.AgentActivity.observeQuery({
      filter: { terminalId: { eq: session.id } }
    }).subscribe({
      next: (data) => {
        const sorted = [...data.items]
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 50); 
        setActivities(sorted);
      },
      error: (err) => console.error("Error observing activities:", err)
    });

    return () => sub.unsubscribe();
  }, [isOpen, session?.id]);

  const handleToggleDeusExMachina = async () => {
    if (!session?.id || isTogglingDeus) return;
    
    setIsTogglingDeus(true);
    const newState = !isDeusExMachinaEnabled;
    setIsDeusExMachinaEnabled(newState);
    
    try {
      await client.models.ConsoleTerminal.update({
        id: session.id,
        deusExMachina: newState
      });
    } catch (err) {
      console.error("Failed to update Deus Ex Machina state", err);
      setIsDeusExMachinaEnabled(!newState); 
    } finally {
      setIsTogglingDeus(false);
    }
  };

  const confirmKillSwitch = async () => {
    if (!session?.id) return;
    setIsKilling(true);
    setIsKillModalOpen(false);
    try {
      await client.models.ConsoleTerminal.update({
        id: session.id,
        haltRequested: true 
      });
      await client.models.AgentActivity.create({
        terminalId: session.id,
        userId: session.userId,
        lifecycleState: 'FAILED',
        toolName: 'system_kill_switch',
        thoughtLog: 'User initiated emergency halt. Active execution cancelled.',
        modelId: session?.contextProfile?.foundationModel?.apiIdentifier || 'amazon.nova-pro-v1:0',
        durationMs: 0
      });
      onClose();
    } catch (err) {
      console.error("Failed to halt agent activity", err);
    } finally {
      setIsKilling(false);
    }
  };

  const getStateBadge = (state: string | null | undefined) => {
    switch (state) {
      case 'RUNNING': return <span style={{ color: '#3b82f6', fontWeight: 600 }}>🟢 Running</span>;
      case 'SLEEPING': return <span style={{ color: '#eab308', fontWeight: 600 }}>🟡 Sleeping</span>;
      case 'BLOCKED': return <span style={{ color: '#f97316', fontWeight: 600 }}>🟠 Blocked (Awaiting Approval)</span>;
      case 'FAILED': return <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 Failed</span>;
      case 'COMPLETED': return <span style={{ color: '#10b981', fontWeight: 600 }}>🔵 Completed</span>;
      default: return <span style={{ color: '#9ca3af', fontWeight: 600 }}>⚪ Unknown</span>;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>
        {`
          .hitl-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
          .hitl-switch input { opacity: 0; width: 0; height: 0; }
          .hitl-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${darkMode ? '#4b5563' : '#ccc'}; transition: .3s; border-radius: 34px; }
          .hitl-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
          .hitl-switch input:checked + .hitl-slider { background-color: ${darkMode ? '#ffffff' : '#0B0B45'}; }
          .hitl-switch input:checked + .hitl-slider:before { transform: translateX(20px); background-color: ${darkMode ? '#0B0B45' : '#ffffff'}; }
          .hitl-switch.disabled .hitl-slider { opacity: 0.5; cursor: not-allowed; }
        `}
      </style>

      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999 }}></div>
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '100%',
        backgroundColor: darkMode ? '#111827' : '#ffffff', borderLeft: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
        zIndex: 10000, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', fontFamily: 'Google Sans Code, monospace'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.25rem 0', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem', fontFamily: 'Bodoni Moda Variable, serif' }}>Agent Activity Center</h2>
              <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Soubriquet: {session?.title}</span><br/>
              <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Session ID: {session?.id}</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: '1.25rem' }}><i className="bx bx-x"></i></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '8px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.85rem', color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Bodoni Moda Variable' }}>Deus Ex Machina (HITL)</strong>
                <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Require human approval for critical tool executions.</span>
              </div>
              <label className={`hitl-switch ${isTogglingDeus ? 'disabled' : ''}`}>
                <input type="checkbox" checked={isDeusExMachinaEnabled} onChange={handleToggleDeusExMachina} disabled={isTogglingDeus} />
                <span className="hitl-slider"></span>
              </label>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '1rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.85rem', color: darkMode ? '#9e0f33' : '#800020', fontFamily: 'Bodoni Moda Variable' }}>Emergency Kill Switch</strong>
                <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Immediately halt ongoing processes.</span>
              </div>
              <button 
                onClick={() => setIsKillModalOpen(true)}
                disabled={isKilling || session?.status === 'ARCHIVED'}
                style={{
                  padding: '0.4rem 1rem', backgroundColor: '#800020', color: 'white', border: 'none', borderRadius: '4px',
                  fontSize: '0.75rem', fontWeight: 700, cursor: (isKilling || session?.status === 'ARCHIVED') ? 'not-allowed' : 'pointer',
                  fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.13rem', textTransform: 'uppercase',
                  opacity: (isKilling || session?.status === 'ARCHIVED') ? 0.5 : 1
                }}
              >
                {isKilling ? 'Halting...' : 'Stop Agent'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: darkMode ? '#d1d5db' : '#4b5563' }}>Live Telemetry Log</h3>
          
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: darkMode ? '#6b7280' : '#9ca3af', fontSize: '0.85rem' }}>
              No background activity recorded yet.
            </div>
          ) : (
            activities.map((act) => (
              <div key={act.id} style={{
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px', padding: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem' }}>{getStateBadge(act.lifecycleState)}</div>
                  <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    {new Date(act.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: darkMode ? '#f9fafb' : '#111827', marginBottom: '0.75rem', fontWeight: 600 }}>
                  <i className="fa-solid fa-wrench" style={{ marginRight: '0.5rem', color: '#6366f1' }}></i>
                  {act.toolName || 'Reasoning Engine'}
                </div>

                <div style={{
                  backgroundColor: darkMode ? '#111827' : '#f3f4f6', padding: '0.75rem', borderRadius: '4px',
                  fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: '150px', overflowY: 'auto'
                }}>
                  {act.thoughtLog || 'Executing parameters...'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    <i className="fa-solid fa-microchip" style={{ marginRight: '0.25rem' }}></i> {act.modelId?.split('/')[1] || 'amazon.nova'}
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }} title="Input Tokens">
                      <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: '0.25rem' }}></i> {act.inputTokens?.toLocaleString() || 0}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }} title="Output Tokens">
                      <i className="fa-solid fa-arrow-right-from-bracket" style={{ marginRight: '0.25rem' }}></i> {act.outputTokens?.toLocaleString() || 0}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }} title="Execution Duration">
                      <i className="fa-solid fa-stopwatch" style={{ marginRight: '0.25rem' }}></i> {(act.durationMs || 0) / 1000}s
                    </span>
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }} title="Compute Credits">
                      <i className="fa-solid fa-coins" style={{ marginRight: '0.25rem' }}></i> {act.computeCredits || 0}
                    </span>
                  </div>
                </div>
                
                {act.scheduledFor && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#eab308', backgroundColor: darkMode ? '#422006' : '#fef08a', padding: '0.5rem', borderRadius: '4px' }}>
                    <i className="fa-solid fa-clock" style={{ marginRight: '0.25rem' }}></i> Scheduled to resume: {new Date(act.scheduledFor).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <BottomRightModal
        isOpen={isKillModalOpen}
        onClose={() => setIsKillModalOpen(false)}
        title="Halt Agent Execution"
        icon={<i className="fa-solid fa-solid fa-radiation" style={{ color: '#800020' }}></i>}
        darkMode={darkMode}
        footer={
           <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
             <button 
                onClick={() => setIsKillModalOpen(false)} 
                style={{ background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#d1d5db' : '#4b5563', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
             >
               Cancel
             </button>
             <button 
                onClick={confirmKillSwitch} 
                style={{ background: '#800020', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.05rem', textTransform: 'uppercase' }}
             >
               Halt Agent
             </button>
           </div>
        }
      >
        <div style={{ fontSize: '0.9rem', color: darkMode ? '#d1d5db' : '#4b5563', lineHeight: 1.5, fontFamily: 'Google Sans Code, monospace' }}>
          Are you sure you want to terminate this ongoing agent operation? This will immediately cancel processing, but your terminal session will remain active for future instructions.
          <br/><br/>
          <strong style={{ color: darkMode ? '#9e0f33' : '#800020' }}>This action cannot be undone.</strong>
        </div>
      </BottomRightModal>
    </>,
    document.body
  );
};