import DrawerModal from './drawermodal';
import type { DeepTerminalSession } from '../pages/terminalsession';
import type { Schema } from '../../amplify/data/resource'; 
import { getModelIcon, getPriorityText } from '../utils/voltaire';

interface WorkflowsDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
  session: DeepTerminalSession | null;
}

export const WorkflowsDrawerModal = ({ isOpen, onClose, darkMode = false, session }: WorkflowsDrawerModalProps) => {
  
  const formatInputTooltip = (params: (Schema['WorkflowParameter']['type'] | null | undefined)[] | null | undefined) => {
    if (!params || params.length === 0) return 'No input parameters required.';
    
    const validParams = params.filter((p): p is Schema['WorkflowParameter']['type'] => p != null);
    if (validParams.length === 0) return 'No input parameters required.';

    return validParams.map(p => 
      `${p.variable} (${p.type || 'string'})${p.isRequired ? ' - Required' : ' - Optional'}`
    ).join('\n');
  };

  const formatOutputTooltip = (vars: (Schema['WorkflowParameter']['type'] | null | undefined)[] | null | undefined) => {
    if (!vars || vars.length === 0) return 'No output variables mapped.';
    
    const validVars = vars.filter((v): v is Schema['WorkflowParameter']['type'] => v != null);
    if (validVars.length === 0) return 'No output variables mapped.';

    return validVars.map(v => `${v.variable} (${v.type || 'string'})`).join('\n');
  };

  return (
    <DrawerModal
      isOpen={isOpen}
      onClose={onClose}
      icon={<i className="fa-solid fa-circle-nodes" />}
      title="Linked Automation Workflows"
      darkMode={darkMode}
      width="650px"
      height="100vh"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', paddingRight: '0.5rem' }}>
        
        {!session?.contextProfile?.workflows || session.contextProfile.workflows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', height: '100%', padding: '2rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            <i className="fa-solid fa-circle-nodes" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
            <span>{session?.contextProfile?.name} does not have any linked Automation Workflows.</span>
          </div>
        ) : (
          session.contextProfile.workflows.map((link: any, index: number) => {
            const wf = link?.contextWorkflow as Schema['ContextWorkflow']['type'] | undefined;
            
            if (!wf) return null;

            return (
              <div key={wf.id || index} style={{ padding: '1.25rem', borderRadius: '8px', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  
                  <img 
                    src={getModelIcon(wf.tool || '')} 
                    alt={`${wf.tool} Icon`} 
                    style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }} 
                  />
                  
                  <div>
                    <h4 style={{ margin: '0', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>{wf.name}</h4>
                    <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>{wf.tool}</span>
                  </div>
                </div>
                
                <p style={{ margin: '0 0 1rem 0', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {wf.description || 'No description provided.'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Agentic Priority</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Bodoni Moda Variable' }}>{wf.vectorFactor || 0}&deg;</span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.65rem', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600, letterSpacing: '0.13rem' }}>
                      {getPriorityText(wf.vectorFactor)}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Authentication</span>
                    <div style={{ marginTop: '0.5rem' }}>
                      {wf.requiresAuth ? (
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '4px', fontWeight: 600 }}>
                          <i className="fa-solid fa-lock" style={{marginRight: '0.25rem'}}></i> Auth Required
                        </span>
                      ) : (
                         <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '4px', fontWeight: 600 }}>
                          <i className="fa-solid fa-lock-open" style={{marginRight: '0.25rem'}}></i> Open
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>I/O Schema</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                      <span 
                        title={formatInputTooltip(wf.inputParameters)}
                        style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#d1d5db' : '#4b5563', borderRadius: '4px', fontWeight: 600, width: 'fit-content', cursor: 'help' }}
                      >
                        <i className="fa-solid fa-arrow-right-to-bracket" style={{marginRight: '0.25rem'}}></i> {wf.inputParameters?.length || 0} Inputs
                      </span>
                      <span 
                        title={formatOutputTooltip(wf.outputVariables)}
                        style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#d1d5db' : '#4b5563', borderRadius: '4px', fontWeight: 600, width: 'fit-content', cursor: 'help' }}
                      >
                        <i className="fa-solid fa-arrow-right-from-bracket" style={{marginRight: '0.25rem'}}></i> {wf.outputVariables?.length || 0} Outputs
                      </span>
                    </div>
                  </div>

                </div>

                <div style={{ marginTop: '1rem', fontSize: '0.75rem', fontFamily: 'Google Sans Code, monospace', backgroundColor: darkMode ? '#111827' : '#ffffff', padding: '0.75rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <div style={{ color: darkMode ? '#9ca3af' : '#6b7280', marginBottom: '0.25rem' }}>Endpoint:</div>
                  <div style={{ color: '#2563eb', wordBreak: 'break-all' }}>{wf.triggerURL}</div>
                  
                  {wf.callbackURL && (
                     <>
                       <div style={{ color: darkMode ? '#9ca3af' : '#6b7280', marginTop: '0.75rem', marginBottom: '0.25rem' }}>Callback:</div>
                       <div style={{ color: '#10b981', wordBreak: 'break-all' }}>{wf.callbackURL}</div>
                     </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </DrawerModal>
  );
};