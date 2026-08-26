import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';

const WatchtowerDashboard = ({ darkMode = false, isAdmin = false, currentUserId = '' }) => {
  const client = generateClient() as any;
  const [usageRecords, setUsageRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const filter = isAdmin ? undefined : { userId: { eq: currentUserId } };
        const { data } = await client.models.UsageRecord.list({ filter, limit: 1000 });
        setUsageRecords(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (err) {
        console.error("Failed to fetch usage metrics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, [isAdmin, currentUserId]);

  const filteredRecords = usageRecords.filter(rec => {
    const matchesAction = actionFilter === 'ALL' || rec.actionType === actionFilter;
    const matchesSession = (rec.sessionId?.toLowerCase() || '').includes(sessionFilter.toLowerCase()) || 
                           (rec.sessionTitle?.toLowerCase() || '').includes(sessionFilter.toLowerCase());
    return matchesAction && matchesSession;
  });

  // Calculate Compute Aggregates
  const totalCreditsBurned = filteredRecords.reduce((sum, rec) => sum + (rec.creditsUsed || 0), 0);
  const totalTokens = filteredRecords.reduce((sum, rec) => sum + (rec.inputTokens || 0) + (rec.outputTokens || 0), 0);

  return (
    <div style={{ padding: '2rem', marginTop: '7.3rem', minHeight: 'calc(100vh - 7.3rem)', backgroundColor: darkMode ? '#111827' : '#f9fafb', color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Google Sans Code, monospace' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '2rem' }}>Watchtower Metrics</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            {isAdmin ? 'System-wide compute usage telemetry and unit economics.' : 'Your personal compute usage and session telemetry.'}
          </p>
        </div>
      </div>

      {/* High-Level Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Credits Burned (Filtered)</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalCreditsBurned.toLocaleString()}</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Total Tokens Processed</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalTokens.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input 
          type="text" 
          placeholder="Filter by Session ID or Title..." 
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          style={{ padding: '0.5rem 1rem', borderRadius: '4px', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827' }}
        />
        <select 
          value={actionFilter} 
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ padding: '0.5rem 1rem', borderRadius: '4px', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827' }}
        >
          <option value="ALL">All Actions</option>
          <option value="LLM_INFERENCE">LLM Chat / Inference</option>
          <option value="TOOL_EXECUTION">Agentic Tools / Media</option>
        </select>
      </div>

      {/* Telemetry Data Table */}
      <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: darkMode ? '#111827' : '#f3f4f6', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>Date</th>
              {isAdmin && <th style={{ padding: '1rem' }}>User ID</th>}
              <th style={{ padding: '1rem' }}>Session</th>
              <th style={{ padding: '1rem' }}>Action / Origin</th>
              <th style={{ padding: '1rem' }}>Target (Model / Tool)</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Credits</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading telemetry...</td></tr>
            ) : filteredRecords.map((rec) => (
              <tr key={rec.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                <td style={{ padding: '1rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{new Date(rec.createdAt).toLocaleString()}</td>
                {isAdmin && <td style={{ padding: '1rem' }}>{rec.userId.substring(0, 8)}...</td>}
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 'bold' }}>{rec.sessionTitle}</div>
                  <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{rec.sessionId}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ 
                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                    backgroundColor: rec.actionType === 'TOOL_EXECUTION' ? (darkMode ? '#3730a3' : '#e0e7ff') : (darkMode ? '#064e3b' : '#d1fae5'),
                    color: rec.actionType === 'TOOL_EXECUTION' ? (darkMode ? '#a5b4fc' : '#4338ca') : (darkMode ? '#6ee7b7' : '#047857')
                  }}>
                    {rec.actionType}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{rec.actionType === 'TOOL_EXECUTION' ? rec.toolName : rec.modelId}</td>
                <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 'bold', color: '#fca5a5' }}>-{rec.creditsUsed.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WatchtowerDashboard;