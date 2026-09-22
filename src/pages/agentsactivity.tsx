import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { generateClient } from 'aws-amplify/data';
import type { SelectionSet } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { getCurrentUser } from 'aws-amplify/auth';
import { CubeIcon } from '../components/cube';
import BottomRightModal from '../components/bottomrightmodal';

const client = generateClient<Schema>();

const activitySelectionSet = [
  'id', 'terminalId', 'userId', 'lifecycleState', 'toolName', 'computeCredits', 
  'inputTokens', 'outputTokens', 'modelId', 'durationMs', 'thoughtLog', 'scheduledFor', 'createdAt',
  'terminal.id', 'terminal.title', 'terminal.deusExMachina', 'terminal.status',
  'terminal.contextProfile.name', 'terminal.contextProfile.role',
  'terminal.contextProfile.workflows.*',
  'terminal.contextProfile.workflows.contextWorkflow.name',
  'terminal.contextProfile.vectorCollection.name',
  'terminal.contextProfile.vectorCollection.documents.*'
] as const;

export type DeepAgentActivity = SelectionSet<Schema['AgentActivity']['type'], typeof activitySelectionSet>;

interface AgentActivityDashboardProps {
  darkMode?: boolean;
}

interface KillModalConfig {
  isOpen: boolean;
  type: 'GLOBAL' | 'LOCAL' | 'INFO' | null;
  terminalId?: string;
  activityId?: string;
  activeCount?: number;
}

const AgentActivity: React.FC<AgentActivityDashboardProps> = ({ darkMode = false }) => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<DeepAgentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [isKillingGlobal, setIsKillingGlobal] = useState(false);
  const [killingLocalId, setKillingLocalId] = useState<string | null>(null);
  const [killModal, setKillModal] = useState<KillModalConfig>({ isOpen: false, type: null });

  useEffect(() => {
    let isMounted = true;
    let sub: any;

    const fetchActivities = async () => {
      try {
        const user = await getCurrentUser();
        if (!isMounted) return;
        
        sub = client.models.AgentActivity.observeQuery({
          filter: { userId: { eq: user.userId } },
          selectionSet: activitySelectionSet as any
        }).subscribe({
          next: (data) => {
            if (!isMounted) return;
            const sorted = [...data.items]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 100);
            
            setActivities(sorted as unknown as DeepAgentActivity[]);
            setIsLoading(false);
          },
          error: (err) => {
            console.error("Error fetching agent activities:", err);
            if (isMounted) setIsLoading(false);
          }
        });
      } catch (err) {
        console.error("Authentication check failed", err);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchActivities();
    
    return () => { 
      isMounted = false;
      if (sub) sub.unsubscribe(); 
    };
  }, []);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchesStatus = statusFilter === 'ALL' || act.lifecycleState === statusFilter;
      const termTitle = act.terminal?.title || '';
      const profileName = act.terminal?.contextProfile?.name || '';
      const tool = act.toolName || '';
      const matchesSearch = searchQuery === '' || 
        termTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesSearch;
    });
  }, [activities, statusFilter, searchQuery]);

  const activeCount = filteredActivities.filter(a => a.lifecycleState === 'RUNNING' || a.lifecycleState === 'BLOCKED').length;
  const sleepingCount = filteredActivities.filter(a => a.lifecycleState === 'SLEEPING').length;
  const totalTokens = filteredActivities.reduce((acc, act) => acc + (act.inputTokens || 0) + (act.outputTokens || 0), 0);
  const totalCredits = filteredActivities.reduce((acc, act) => acc + (act.computeCredits || 0), 0);

  const initiateLocalKill = (terminalId: string, activityId: string) => {
    setKillModal({ isOpen: true, type: 'LOCAL', terminalId, activityId });
  };

  const initiateGlobalKill = () => {
    const activeTerminals = Array.from(new Set(activities.filter(a => ['RUNNING', 'SLEEPING', 'BLOCKED'].includes(a.lifecycleState || '')).map(a => a.terminalId)));
    if (activeTerminals.length === 0) {
      setKillModal({ isOpen: true, type: 'INFO' });
      return;
    }
    setKillModal({ isOpen: true, type: 'GLOBAL', activeCount: activeTerminals.length });
  };

  const confirmLocalKill = async () => {
    const { terminalId, activityId } = killModal;
    if (!terminalId || !activityId) return;
    setKillModal({ isOpen: false, type: null });
    
    setKillingLocalId(activityId);
    try {
      await client.models.ConsoleTerminal.update({ id: terminalId, haltRequested: true });
      await client.models.AgentActivity.create({
        terminalId, userId: activities[0]?.userId || '', lifecycleState: 'FAILED',
        toolName: 'system_kill_switch', thoughtLog: 'User initiated emergency halt. Active execution cancelled.',
        modelId: activities.find(a => a.id === activityId)?.modelId || 'amazon.nova-pro-v1:0',
        durationMs: 0
      });
    } catch (err) {
      console.error("Failed to halt agent", err);
    } finally {
      setKillingLocalId(null);
    }
  };

  const confirmGlobalKill = async () => {
    const activeTerminals = Array.from(new Set(activities.filter(a => ['RUNNING', 'SLEEPING', 'BLOCKED'].includes(a.lifecycleState || '')).map(a => a.terminalId)));
    setKillModal({ isOpen: false, type: null });
    
    setIsKillingGlobal(true);
    try {
      for (const tId of activeTerminals) {
        await client.models.ConsoleTerminal.update({ id: tId, haltRequested: true });
        const activeOp = activities.find(a => a.terminalId === tId && ['RUNNING', 'SLEEPING', 'BLOCKED'].includes(a.lifecycleState || ''));
        
        await client.models.AgentActivity.create({
          terminalId: tId, userId: activities[0]?.userId || '', lifecycleState: 'FAILED',
          toolName: 'global_kill_switch', thoughtLog: 'User triggered Global Kill Switch. Active execution cancelled.', 
          modelId: activeOp?.modelId || 'amazon.nova-pro-v1:0',
          durationMs: 0
        });
      }
    } catch (err) {
      console.error("Global kill switch encountered an error:", err);
    } finally {
      setIsKillingGlobal(false);
    }
  };

  const getStateBadge = (state: string | null | undefined) => {
    switch (state) {
      case 'RUNNING': return <span style={{ color: '#10b981', backgroundColor: '#10b9811c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}><i className="bx bx-loader-alt bx-spin" style={{ marginRight: '4px' }}></i> RUNNING</span>;
      case 'SLEEPING': return <span style={{ color: '#eab308', backgroundColor: '#eab3081c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}><i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i> SCHEDULED</span>;
      case 'BLOCKED': return <span style={{ color: '#f97316', backgroundColor: '#f973161c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}><i className="fa-solid fa-hand" style={{ marginRight: '4px' }}></i> BLOCKED (HITL)</span>;
      case 'FAILED': return <span style={{ color: '#ef4444', backgroundColor: '#ef44441c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}><i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i> FAILED</span>;
      case 'COMPLETED': return <span style={{ color: '#3b82f6', backgroundColor: '#3b82f61c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}><i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> COMPLETED</span>;
      default: return <span style={{ color: '#9ca3af', backgroundColor: '#9ca3af1c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>UNKNOWN</span>;
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: darkMode ? '#1b1c1d' : '#f9fafb', color: darkMode ? '#fff' : '#0b0b45', fontFamily: 'Google Sans Code, monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <CubeIcon width={30} height={30} darkMode={darkMode} edgeColor={darkMode ? '#ffffff' : '#0B0B45'} animationDuration="2s" />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0' }}>LOADING TELEMETRY...</h3>
          <p style={{ opacity: 0.5, fontSize: '0.85rem', margin: 0 }}>Syncing Agent Activity Records.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '2rem',
      paddingTop: '9.3rem', 
      minHeight: '100vh',
      boxSizing: 'border-box',
      backgroundColor: darkMode ? '#1b1c1d' : '#f9fafb',
      color: darkMode ? '#f9fafb' : '#0b0b45',
      fontFamily: 'Google Sans Code, monospace'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        <style>
          {`
            .watchtower-tooltip-wrapper { position: relative; display: inline-flex; align-items: center; cursor: help; margin-left: 0.5rem; color: #6366f1; }
            .watchtower-tooltip-content {
              visibility: hidden; opacity: 0; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%) translateY(10px);
              background-color: ${darkMode ? '#1f2937' : '#ffffff'}; color: ${darkMode ? '#f9fafb' : '#111827'};
              border: 1px solid ${darkMode ? '#374151' : '#e5e7eb'}; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
              padding: 0.75rem; border-radius: 6px; font-size: 0.75rem; min-width: max-content;
              z-index: 50; transition: all 0.2s ease;
            }
            .watchtower-tooltip-wrapper:hover .watchtower-tooltip-content { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0); }
            .watchtower-tooltip-content::after {
              content: ""; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid;
              border-color: ${darkMode ? '#374151' : '#e5e7eb'} transparent transparent transparent;
            }
          `}
        </style>

        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', 
          marginBottom: '2rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingBottom: '1rem' 
        }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable, serif', fontSize: '2rem' }}>
              Agents Watchtower
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              Agentic telemetry and tool orchestration monitor.
            </p>
          </div>
          <button 
            onClick={initiateGlobalKill}
            disabled={isKillingGlobal || (activeCount === 0 && sleepingCount === 0)}
            style={{
              padding: '0.6rem 1.25rem', backgroundColor: '#800020', color: 'white', border: 'none', borderRadius: '6px',
              fontSize: '0.8rem', fontWeight: 700, 
              cursor: (isKillingGlobal || (activeCount === 0 && sleepingCount === 0)) ? 'not-allowed' : 'pointer',
              fontFamily: 'Bodoni Moda Variable, serif', letterSpacing: '0.1rem', textTransform: 'uppercase',
              boxShadow: '0 4px 6px rgba(128, 0, 32, 0.2)', 
              opacity: (isKillingGlobal || (activeCount === 0 && sleepingCount === 0)) ? 0.5 : 1, 
              transition: 'all 0.2s',
              marginBottom: '0.25rem'
            }}
          >
            {isKillingGlobal ? 'Initiating Global Halt...' : <><i className="fa-solid fa-radiation" style={{ marginRight: '8px' }}></i> Global Kill Switch</>}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Active Agents', value: activeCount, icon: 'fa-microchip', color: '#10b981' },
            { label: 'Scheduled Tasks', value: sleepingCount, icon: 'fa-clock', color: '#eab308' },
            { label: 'Tokens Burned', value: totalTokens.toLocaleString(), icon: 'fa-layer-group', color: '#6366f1' },
            { label: 'Credits Consumed', value: totalCredits.toFixed(2), icon: 'fa-coins', color: '#f59e0b' },
          ].map((kpi, idx) => (
            <div key={idx} style={{ 
              backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '8px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: `${kpi.color}15`, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                <i className={`fa-solid ${kpi.icon}`}></i>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Bodoni Moda Variable, serif', color: darkMode ? '#f9fafb' : '#111827' }}>{kpi.value}</div>
                <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <i className="bx bx-search" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: darkMode ? '#9ca3af' : '#6b7280' }}></i>
            <input 
              type="text" 
              placeholder="Search by Agent, Tool, or Terminal..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '6px', fontSize: '0.85rem',
                border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ 
              padding: '0.65rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer',
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, backgroundColor: darkMode ? '#1f2937' : '#ffffff',
              color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'inherit'
            }}
          >
            <option value="ALL">All States</option>
            <option value="RUNNING">Running</option>
            <option value="BLOCKED">Blocked (HITL)</option>
            <option value="SLEEPING">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div style={{ 
          backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
          borderRadius: '8px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {filteredActivities.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
              <i className={`fa-solid ${activities.length === 0 ? 'fa-satellite-dish' : 'fa-filter-circle-xmark'}`} style={{ fontSize: '3rem', color: darkMode ? '#374151' : '#d1d5db', marginBottom: '1rem' }}></i>
              <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>
                {activities.length === 0 ? 'No Agent Activity Recorded' : 'No Matches Found'}
              </h3>
              <p style={{ margin: 0, color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.85rem' }}>
                {activities.length === 0 
                  ? 'There are currently no telemetry records or agent activities associated with your account.' 
                  : 'There are no telemetry records matching your current search or status filters.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: darkMode ? '#111827' : '#f9fafb', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>State</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intelligence Engine</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action Trace</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Terminal Bind</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Economics</th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 600, color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Operations</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((act) => {
                  const profile = act.terminal?.contextProfile;
                  const wfCount = profile?.workflows?.length || 0;
                  const vcName = profile?.vectorCollection?.name;
                  const docCount = profile?.vectorCollection?.documents?.length || 0;

                  return (
                    <tr key={act.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, transition: 'background-color 0.2s', ':hover': { backgroundColor: darkMode ? '#374151' : '#f3f4f6' } } as any}>
                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                        <div style={{ marginBottom: '0.5rem' }}>{getStateBadge(act.lifecycleState)}</div>
                        <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{new Date(act.createdAt).toLocaleString()}</div>
                        {act.scheduledFor && <div style={{ fontSize: '0.7rem', color: '#eab308', marginTop: '0.25rem' }}>Wakes: {new Date(act.scheduledFor).toLocaleTimeString()}</div>}
                      </td>

                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: darkMode ? '#f9fafb' : '#111827' }}>
                          {profile?.name || 'Vanguard Agent'}
                          
                          {wfCount > 0 && (
                            <div className="watchtower-tooltip-wrapper">
                              <i className="fa-solid fa-circle-nodes"></i>
                              <div className="watchtower-tooltip-content">
                                <strong>Linked Workflows ({wfCount})</strong>
                                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem', textAlign: 'left' }}>
                                  {profile?.workflows?.map((w: any, i: number) => (
                                    <li key={i}>{w.contextWorkflow?.name || 'Unknown'}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}

                          {vcName && (
                            <div className="watchtower-tooltip-wrapper" style={{ color: '#10b981' }}>
                              <i className="fa-solid fa-database"></i>
                              <div className="watchtower-tooltip-content">
                                <strong>{vcName}</strong>
                                <div style={{ marginTop: '0.25rem', opacity: 0.8 }}>Contains {docCount} grounded document(s).</div>
                              </div>
                            </div>
                          )}

                        </div>
                        <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <i className="fa-solid fa-microchip"></i> {act.modelId?.split('/')[1] || 'amazon.nova'}
                        </div>
                      </td>

                      <td style={{ padding: '1rem', verticalAlign: 'top', maxWidth: '300px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6366f1', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <i className="fa-solid fa-wrench"></i> {act.toolName || 'Reasoning Engine'}
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', backgroundColor: darkMode ? '#111827' : '#f3f4f6', 
                          padding: '0.5rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                          maxHeight: '60px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' 
                        }}>
                          {act.thoughtLog}
                        </div>
                      </td>

                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: darkMode ? '#f9fafb' : '#111827', marginBottom: '0.25rem' }}>{act.terminal?.title || 'Unnamed Session'}</div>
                        <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          ID: <code style={{ backgroundColor: darkMode ? '#374151' : '#e5e7eb', padding: '2px 4px', borderRadius: '4px' }}>{act.terminalId.split('-')[0]}</code>
                        </div>
                        {act.terminal?.deusExMachina && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', backgroundColor: '#80002015', color: '#800020', border: '1px solid #80002030', padding: '0.15rem 0.4rem', borderRadius: '4px', display: 'inline-block', fontWeight: 700 }}>
                            HITL ENABLED
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563' }} title="Input / Output Tokens">
                            <i className="fa-solid fa-layer-group" style={{ width: '16px', color: '#6366f1' }}></i> 
                            {((act.inputTokens || 0) + (act.outputTokens || 0)).toLocaleString()} TKN
                          </span>
                          <span style={{ fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563' }} title="Compute Credits Burned">
                            <i className="fa-solid fa-coins" style={{ width: '16px', color: '#f59e0b' }}></i> 
                            {act.computeCredits?.toFixed(2) || 0} CRD
                          </span>
                          <span style={{ fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563' }} title="Execution Duration">
                            <i className="fa-solid fa-stopwatch" style={{ width: '16px', color: '#10b981' }}></i> 
                            {((act.durationMs || 0) / 1000).toFixed(2)}s
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '1rem', verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button 
                            onClick={() => navigate(`/console-terminals/session/${act.terminalId}`)}
                            style={{
                              background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#d1d5db' : '#4b5563',
                              width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                            }}
                            title="Open Terminal Session"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <i className="fa-solid fa-terminal"></i>
                          </button>
                          
                          {(act.lifecycleState === 'RUNNING' || act.lifecycleState === 'SLEEPING' || act.lifecycleState === 'BLOCKED') && (
                            <button 
                              onClick={() => initiateLocalKill(act.terminalId, act.id)}
                              disabled={killingLocalId === act.id}
                              style={{
                                background: '#ef444415', border: '1px solid #ef444450', color: '#ef4444',
                                width: '32px', height: '32px', borderRadius: '6px', cursor: killingLocalId === act.id ? 'not-allowed' : 'pointer', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: killingLocalId === act.id ? 0.5 : 1
                              }}
                              title="Halt Agent Execution"
                              onMouseEnter={(e) => e.currentTarget.style.background = '#ef444430'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#ef444415'}
                            >
                              <i className={killingLocalId === act.id ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-power-off"}></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {createPortal(
        <BottomRightModal
          isOpen={killModal.isOpen}
          onClose={() => setKillModal({ isOpen: false, type: null })}
          title={killModal.type === 'GLOBAL' ? "Global Kill Switch" : killModal.type === 'INFO' ? "System Status" : "Halt Agent Execution"}
          icon={killModal.type === 'INFO' ? <i className="fa-solid fa-circle-info" style={{ color: '#3b82f6' }}></i> : <i className="fa-solid fa-radiation" style={{ color: '#800020' }}></i>}
          darkMode={darkMode}
          footer={
             killModal.type === 'INFO' ? (
               <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                 <button 
                    onClick={() => setKillModal({ isOpen: false, type: null })} 
                    style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05rem' }}
                 >
                   Acknowledged
                 </button>
               </div>
             ) : (
               <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
                 <button 
                    onClick={() => setKillModal({ isOpen: false, type: null })} 
                    style={{ background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#d1d5db' : '#4b5563', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                 >
                   Cancel
                 </button>
                 <button 
                    onClick={killModal.type === 'GLOBAL' ? confirmGlobalKill : confirmLocalKill} 
                    style={{ background: '#800020', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.05rem', textTransform: 'uppercase' }}
                 >
                   {killModal.type === 'GLOBAL' ? 'Halt All Agents' : 'Halt Agent'}
                 </button>
               </div>
             )
          }
        >
          <div style={{ fontSize: '0.9rem', color: darkMode ? '#d1d5db' : '#4b5563', lineHeight: 1.5, fontFamily: 'Google Sans Code, monospace' }}>
            {killModal.type === 'GLOBAL' && (
              <>
                Are you absolutely sure? This action will instantly halt and cancel {killModal.activeCount} active or sleeping agent execution(s) across your profile.
                <br/><br/><strong style={{ color: darkMode ? '#9e0f33' : '#800020' }}>This action cannot be undone.</strong>
              </>
            )}
            {killModal.type === 'LOCAL' && (
              <>
                Are you sure you want to terminate this ongoing agent operation? This will immediately cancel processing, but your terminal session will remain active for future instructions.
                <br/><br/><strong style={{ color: darkMode ? '#9e0f33' : '#800020' }}>This action cannot be undone.</strong>
              </>
            )}
            {killModal.type === 'INFO' && (
              <>
                All agentic operations are currently inactive. There are no running, sleeping, or blocked agents that require halting.
              </>
            )}
          </div>
        </BottomRightModal>,
        document.body
      )}

    </div>
  );
};

export default AgentActivity;