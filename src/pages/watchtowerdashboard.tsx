import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import SearchRibbon from '../components/searchribbon';
import { getCurrentUser } from 'aws-amplify/auth';

const client = generateClient<Schema>();

interface WatchtowerProps {
  darkMode?: boolean;
  isAdmin?: boolean;
  currentUserId?: string;
}

const UsageWatchtower = ({ darkMode = false, isAdmin = false, currentUserId = '' }: WatchtowerProps) => {
  const [usageRecords, setUsageRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [resolvedUserId, setResolvedUserId] = useState<string>(currentUserId);

  useEffect(() => {
    let isMounted = true;
    
    const resolveUser = async () => {
      if (!currentUserId) {
        try {
          const { userId } = await getCurrentUser();
          if (isMounted) setResolvedUserId(userId);
        } catch (err) {
          console.error("Failed to resolve current user for watchtower:", err);
        }
      } else {
        if (isMounted) setResolvedUserId(currentUserId);
      }
    };
    
    resolveUser();
    
    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    let isMounted = true;
    if (!isAdmin && !resolvedUserId) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        let allRecords: any[] = [];
        let currentNextToken: string | null | undefined = null;

        do {
          const response: any = await client.graphql({
            query: `
              query ListUsageRecords($filter: ModelUsageRecordFilterInput, $limit: Int, $nextToken: String) {
                listUsageRecords(filter: $filter, limit: $limit, nextToken: $nextToken) {
                  items {
                    id
                    userId
                    sessionId
                    sessionTitle
                    actionType
                    toolName
                    modelId
                    creditsUsed
                    inputTokens
                    outputTokens
                    monetaryValue
                    createdAt
                  }
                  nextToken
                }
              }
            `,
            variables: {
              filter: isAdmin ? null : { userId: { eq: resolvedUserId } },
              limit: 500,
              nextToken: currentNextToken
            }
          });
          
          const rawItems = response.data.listUsageRecords.items || [];
          allRecords = [...allRecords, ...rawItems];
          currentNextToken = response.data.listUsageRecords.nextToken;
          
        } while (currentNextToken);

        if (isMounted) {
          const validRecords = allRecords.filter(rec => rec !== null && rec !== undefined);
          
          const sortedRecords = validRecords.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setUsageRecords(sortedRecords);
        }
      } catch (err) {
        console.error("Failed to fetch usage metrics:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMetrics();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, resolvedUserId]);

  const filteredRecords = usageRecords.filter((rec) => {
    if (!rec) return false; 

    const matchesAction = actionFilter === 'ALL' || rec.actionType === actionFilter;
    const matchesSession =
      (rec.sessionId?.toLowerCase() || '').includes(sessionFilter.toLowerCase()) ||
      (rec.sessionTitle?.toLowerCase() || '').includes(sessionFilter.toLowerCase());
    return matchesAction && matchesSession;
  });

  const totalCreditsBurned = filteredRecords.reduce((sum, rec) => {
    if (rec.actionType === 'TOP_UP') return sum;
    return sum + Math.abs(rec.creditsUsed || 0);
  }, 0);

  const totalTokens = filteredRecords.reduce((sum, rec) => sum + (rec.inputTokens || 0) + (rec.outputTokens || 0), 0);

  const filterOptions = [
    { label: 'All Actions', value: 'ALL' },
    { label: 'LLM Chat / Inference', value: 'LLM_INFERENCE' },
    { label: 'Agentic Tools / Media', value: 'TOOL_EXECUTION' },
    { label: 'Top-Up Transactions', value: 'TOP_UP' }
  ];

  // Helper styles for standardizing the DataTable headers
  const thStyle: React.CSSProperties = {
    padding: '1rem',
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    color: darkMode ? '#9ca3af' : '#6b7280',
    fontWeight: 600
  };

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
            Watchtower Metrics
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            {isAdmin ? 'System-wide compute usage telemetry and unit economics.' : 'Compute credit usage and session telemetry.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Credits Burned
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalCreditsBurned.toLocaleString()}</div>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Total Tokens Processed
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalTokens.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <SearchRibbon
          darkMode={darkMode}
          recordCount={filteredRecords.length}
          recordLabel="Telemetry Records"
          searchTerm={sessionFilter}
          onSearchChange={setSessionFilter}
          selectedFilter={actionFilter}
          onFilterChange={setActionFilter}
          filterOptions={filterOptions}
        />
      </div>

      <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden' }}>
        {/* FIX 1: Dropped Bodoni Serif font from table to match default DataTable look */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ backgroundColor: darkMode ? '#111827' : '#f3f4f6', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, textAlign: 'left', fontFamily: 'Bodoni Moda Variable' }}>
              <th style={thStyle}>Date</th>
              {isAdmin && <th style={thStyle}>User ID</th>}
              <th style={thStyle}>Session</th>
              <th style={thStyle}>Action / Origin</th>
              <th style={thStyle}>Target (Model / Tool)</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Credits</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontFamily: 'Bodoni Moda Variable' }}>
                  Loading telemetry...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} style={{ padding: '4rem 2rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280', fontFamily: 'Bodoni Moda Variable' }}>
                  <i className="fa-solid fa-chart-line" style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.3, display: 'block' }}></i>
                  No Usage Metrics Data Found
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => (
                <tr key={rec.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <td style={{ padding: '1rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    {new Date(rec.createdAt).toLocaleString()}
                  </td>
                  {isAdmin && <td style={{ padding: '1rem' }}>{(rec.userId || '').substring(0, 8)}...</td>}
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 'bold', fontFamily: 'Bodoni Moda Variable' }}>{rec.sessionTitle || 'Terminal Session'}</div>
                    <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{rec.sessionId || 'N/A'}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        backgroundColor:
                          rec.actionType === 'TOOL_EXECUTION'
                            ? darkMode ? '#3730a3' : '#e0e7ff'
                            : rec.actionType === 'TOP_UP'
                            ? darkMode ? '#065f46' : '#dcfce7'
                            : darkMode ? '#064e3b' : '#d1fae5',
                        color:
                          rec.actionType === 'TOOL_EXECUTION'
                            ? darkMode ? '#a5b4fc' : '#4338ca'
                            : rec.actionType === 'TOP_UP'
                            ? darkMode ? '#34d399' : '#15803d'
                            : darkMode ? '#6ee7b7' : '#047857'
                      }}
                    >
                      {(rec.actionType || 'UNKNOWN').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {rec.actionType === 'TOP_UP' ? (
                      <span style={{ color: darkMode ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>N/A</span>
                    ) : (
                      rec.actionType === 'TOOL_EXECUTION' ? rec.toolName : rec.modelId
                    )}
                  </td>
                  <td
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      color: rec.actionType === 'TOP_UP' ? '#34d399' : '#fca5a5'
                    }}
                  >
                    {rec.actionType === 'TOP_UP' ? '+' : '-'}{Math.abs(rec.creditsUsed || 0).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsageWatchtower;