import { useEffect, useState, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { getCurrentUser } from 'aws-amplify/auth';
import { getUserEmail } from '../utils/asimov';
import * as d3 from 'd3';

const client = generateClient<Schema>();

interface ManagedAgentsProps {
  darkMode?: boolean;
}

interface AgentNode {
  name: string;
  type?: 'supervisor' | 'collaborator' | 'standard' | 'group' | string;
  val?: number;
  children?: AgentNode[];
}

interface BedrockTelemetryData {
  knowledgeBaseStatus?: string;
  activeTools?: string[];
  totalDeployedVersions?: number;
  error?: string;
}

const AmazonBedrockUI = ({ darkMode = false }: ManagedAgentsProps) => {
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string>('');
  
  const [agentActivities, setAgentActivities] = useState<any[]>([]);
  const [contextProfiles, setContextProfiles] = useState<any[]>([]);
  
  const [bedrockTelemetry, setBedrockTelemetry] = useState<Record<string, BedrockTelemetryData>>({});
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  
  const fetchedTelemetryKeysRef = useRef<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let isMounted = true;
    const resolveUser = async () => {
      try {
        const email = await getUserEmail();
        if (!isMounted) return;
        if (email) {
          setResolvedUserId(email);
        } else {
          const { userId } = await getCurrentUser();
          if (isMounted) setResolvedUserId(userId);
        }
      } catch (err) {
        console.error("Failed to resolve user:", err);
      }
    };
    resolveUser();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!resolvedUserId) return;

    const activitySub = client.models.AgentActivity.observeQuery({
      filter: { userId: { eq: resolvedUserId } }
    }).subscribe({
      next: (data) => setAgentActivities(data.items),
      error: (err) => console.error("Failed to fetch activities:", err)
    });

    const profileSub = client.models.ContextProfile.observeQuery({
      filter: { createdBy: { eq: resolvedUserId } },
      selectionSet: [
        'id', 'name', 'role', 'supervisorId', 'provisioningStatus', 
        'enableCodeInterpreter', 'awsAgentId', 'awsAliasId', 'collaborators.*'
      ]
    }).subscribe({
      next: (data) => {
        setContextProfiles(data.items);
        setLoading(false);
      },
      error: (err) => {
        console.error("Failed to fetch profiles:", err);
        setLoading(false);
      }
    });

    return () => {
      activitySub.unsubscribe();
      profileSub.unsubscribe();
    };
  }, [resolvedUserId]);

  useEffect(() => {
    let isMounted = true;

    const fetchBedrockData = async () => {
      const unCachedAgents = contextProfiles.filter(p => {
        if (!p.awsAgentId || !p.awsAliasId) return false;
        const cacheKey = `${p.awsAgentId}:${p.awsAliasId}`;
        return !fetchedTelemetryKeysRef.current.has(cacheKey);
      });

      if (unCachedAgents.length === 0) return;

      setTelemetryLoading(true);
      const newTelemetryMap: Record<string, BedrockTelemetryData> = {};

      await Promise.all(unCachedAgents.map(async (profile) => {
        const cacheKey = `${profile.awsAgentId}:${profile.awsAliasId}`;
        try {
          const res = await client.queries.getAgentTelemetry({
            agentId: profile.awsAgentId!,
            aliasId: profile.awsAliasId!
          });

          if (res.data) {
            const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            newTelemetryMap[profile.id] = parsed;
            fetchedTelemetryKeysRef.current.add(cacheKey);
          }
        } catch (error) {
          console.error(`Telemetry fetch failed for agent ${profile.awsAgentId}:`, error);
          newTelemetryMap[profile.id] = { error: 'Failed to retrieve telemetry' };
        }
      }));

      if (isMounted && Object.keys(newTelemetryMap).length > 0) {
        setBedrockTelemetry(prev => ({ ...prev, ...newTelemetryMap }));
        setTelemetryLoading(false);
      }
    };

    if (contextProfiles.length > 0) {
      fetchBedrockData();
    }

    return () => { isMounted = false; };
  }, [contextProfiles]);

  const activeQueuedTasks = agentActivities.filter(a => a.scheduledFor && new Date(a.scheduledFor).getTime() > Date.now());
  const failedExecutions = agentActivities.filter(a => a.lifecycleState === 'FAILED');
  const avgLatencyMs = agentActivities.length > 0 
    ? agentActivities.reduce((sum, a) => sum + (a.durationMs || 0), 0) / agentActivities.length 
    : 0;

  useEffect(() => {
    if (loading || !svgRef.current || contextProfiles.length === 0) return;

    const rootNode: AgentNode = {
      name: "Managed Agents",
      children: contextProfiles.filter(p => p.role === 'SUPERVISOR').map((sup: any) => ({
        name: sup.name,
        type: 'supervisor',
        val: 100,
        children: Array.isArray(sup.collaborators) 
          ? sup.collaborators.map((collab: any) => {
              const fullCollab = contextProfiles.find(p => p.id === collab.id);
              return {
                name: fullCollab?.name || 'Unknown Collaborator',
                type: 'collaborator',
                val: 50,
                children: []
              };
            }) 
          : []
      }))
    };

    const standardProfiles = contextProfiles.filter(p => p.role === 'STANDARD');
    if (standardProfiles.length > 0) {
      rootNode.children?.push({
        name: "Standard Independent Agents",
        type: 'group',
        val: 80,
        children: standardProfiles.map((std: any) => ({
          name: std.name,
          type: 'standard',
          val: 50,
          children: []
        }))
      });
    }

    const width = 800;
    const height = 500;
    
    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll("*").remove();

    const svg = svgElement
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%")
      .style("font-family", "Google Sans Code, monospace");

    const color = d3.scaleOrdinal<string>()
      .domain(['supervisor', 'collaborator', 'standard', 'group'])
      .range(darkMode ? ['#312e81', '#064e3b', '#4b5563', '#1f2937'] : ['#e0e7ff', '#d1fae5', '#e5e7eb', '#f3f4f6']);

    const pack = d3.pack<AgentNode>()
      .size([width, height])
      .padding(15);

    const hierarchyData = d3.hierarchy<AgentNode>(rootNode)
      .sum(d => d.val || 0);

    const root = pack(hierarchyData);

    const node = svg.selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("circle")
      .attr("r", d => d.r)
      .style("fill", d => d.depth === 0 ? "transparent" : color(d.data.type || 'standard'))
      .style("stroke", darkMode ? '#4b5563' : '#d1d5db')
      .style("stroke-width", d => d.depth === 0 ? 0 : 1)
      .style("cursor", "pointer")
      .on("mouseover", function() { d3.select(this).style("stroke-width", "3px"); })
      .on("mouseout", function() { d3.select(this).style("stroke-width", "1px"); });

    node.append("text")
      .filter(d => !d.children || d.depth === 1)
      .attr("dy", "0.3em")
      .style("text-anchor", "middle")
      .style("font-size", d => Math.min(d.r / 3, 14) + "px")
      .style("fill", darkMode ? "#f9fafb" : "#111827")
      .style("pointer-events", "none")
      .text(d => d.data.name.substring(0, 15) + (d.data.name.length > 15 ? '...' : ''));

  }, [contextProfiles, loading, darkMode]);

  return (
    <div
      style={{
        padding: '2rem',
        marginTop: '7.3rem',
        minHeight: 'calc(100vh - 7.3rem)',
        boxSizing: 'border-box',
        backgroundColor: darkMode ? '#1b1c1d' : '#f9fafb',
        color: darkMode ? '#f9fafb' : '#0b0b45',
        fontFamily: 'Google Sans Code, monospace'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '2rem',
          borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          paddingBottom: '1rem'
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '2rem' }}>
            Bedrock Agents Telemetry
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            Managed Agents hierarchies, task queues and infrastructure health.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Active Supervisors
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{contextProfiles.filter(p => p.role === 'SUPERVISOR').length}</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Queued Nocturnal Tasks
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: activeQueuedTasks.length > 0 ? '#3b82f6' : 'inherit' }}>
            {activeQueuedTasks.length}
          </div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Failed Executions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: failedExecutions.length > 0 ? '#ef4444' : '#10b981' }}>
            {failedExecutions.length}
          </div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Avg Execution Latency
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{(avgLatencyMs / 1000).toFixed(2)}s</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Agent Hierarchy & Delegation Topology</h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            Visualizing structural relationships mapped in AWS Bedrock. Supervisors delegate to Collaborators.
          </p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading Topology...</div>
          ) : (
            <div style={{ width: '100%', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', transform: 'translateZ(0)', willChange: 'transform' }}>
              <svg ref={svgRef}></svg>
            </div>
          )}
        </div>

        <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, backgroundColor: darkMode ? '#111827' : '#f3f4f6' }}>
            <h3 style={{ margin: '0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>AWS Bedrock Infrastructure Health</h3>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              Live control plane insights fetched directly from AWS Bedrock.
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, textAlign: 'left', backgroundColor: darkMode ? '#1f2937' : '#ffffff' }}>
                <th style={{ padding: '1rem' }}>Agent Name</th>
                <th style={{ padding: '1rem' }}>Role</th>
                <th style={{ padding: '1rem' }}>KB Sync Status</th>
                <th style={{ padding: '1rem' }}>Active Tools</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Deployed Versions</th>
              </tr>
            </thead>
            <tbody>
              {telemetryLoading && Object.keys(bedrockTelemetry).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem 1rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    Fetching live Bedrock telemetry...
                  </td>
                </tr>
              ) : contextProfiles.filter(p => p.awsAgentId).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem 1rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    No deployed AWS Bedrock agents found.
                  </td>
                </tr>
              ) : (
                contextProfiles.filter(p => p.awsAgentId).map((profile) => {
                  const telemetry = bedrockTelemetry[profile.id] || {};
                  
                  return (
                    <tr key={profile.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: darkMode ? '#f9fafb' : '#111827' }}>
                        {profile.name}
                        <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280', marginTop: '0.2rem' }}>
                          ID: {profile.awsAgentId}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', 
                          backgroundColor: profile.role === 'SUPERVISOR' ? (darkMode ? '#312e81' : '#e0e7ff') : (darkMode ? '#064e3b' : '#d1fae5'), 
                          color: profile.role === 'SUPERVISOR' ? (darkMode ? '#a5b4fc' : '#4338ca') : (darkMode ? '#34d399' : '#15803d') 
                        }}>
                          {profile.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {telemetry.knowledgeBaseStatus === 'ENABLED' || telemetry.knowledgeBaseStatus === 'ACTIVE' ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>Synced</span>
                        ) : (
                          <span style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>{telemetry.knowledgeBaseStatus || 'UNLINKED'}</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: darkMode ? '#d1d5db' : '#374151' }}>
                        {telemetry.activeTools && telemetry.activeTools.length > 0 
                          ? telemetry.activeTools.join(', ') 
                          : 'None'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: darkMode ? '#f9fafb' : '#111827' }}>
                        {telemetry.totalDeployedVersions || 1}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, backgroundColor: darkMode ? '#111827' : '#f3f4f6' }}>
            <h3 style={{ margin: '0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.25rem' }}>Asynchronous Execution Queue</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Scheduled Time</th>
                <th style={{ padding: '1rem' }}>Lifecycle State</th>
                <th style={{ padding: '1rem' }}>Target Tool / Action</th>
                <th style={{ padding: '1rem' }}>Reasoning Trace</th>
              </tr>
            </thead>
            <tbody>
              {activeQueuedTasks.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '3rem 1rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    No nocturnal or future tasks are currently queued.
                  </td>
                </tr>
              ) : (
                activeQueuedTasks.map((task: any) => (
                  <tr key={task.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                    <td style={{ padding: '1rem', color: '#3b82f6', fontWeight: 'bold' }}>
                      {new Date(task.scheduledFor).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: darkMode ? '#78350f' : '#fef3c7', color: darkMode ? '#fbbf24' : '#d97706' }}>
                        {task.lifecycleState}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{task.toolName || 'Unknown Tool'}</td>
                    <td style={{ padding: '1rem', color: darkMode ? '#9ca3af' : '#6b7280', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.thoughtLog || 'Awaiting execution window...'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AmazonBedrockUI;