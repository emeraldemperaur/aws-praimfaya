import { useEffect, useMemo, useState } from "react";
import FAButton from "../components/floatingactionbutton";
import TitleRibbon from "../components/titleribbon";
import SearchRibbon from "../components/searchribbon";
import type { ColumnDef } from "../components/datatable";
import DataTable from "../components/datatable";
import BottomRightModal from "../components/bottomrightmodal";
import ExtraLargeModal from "../components/extralargemodal";
import FullScreenModal from "../components/fullscreenmodal";
import { useNavigate } from "react-router-dom";
import { getInitials, getModelIcon, inputStyle, labelStyle } from "../utils/voltaire";
import { generateClient } from "aws-amplify/api";
import type { UIConsoleTerminal } from "../data/consoleterminal";
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { getUserEmail } from "../utils/asimov";


const TerminalConsoleUI = ({ darkMode }: { darkMode: boolean }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('title');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewConsoleTerminal, setViewConsoleTerminal] = useState<UIConsoleTerminal | null>(null);
  const [deleteConsoleTerminal, setDeleteConsoleTerminal] = useState<UIConsoleTerminal | null>(null);
  const [editConsoleTerminal, setEditConsoleTerminal] = useState<UIConsoleTerminal | null>(null);
  
  const [visibleTranscriptCount, setVisibleTranscriptCount] = useState(20);

  const [newConsoleTerminalData, setNewConsoleTerminalData] = useState<Partial<UIConsoleTerminal>>({
    title: '',
    contextProfileId: '',
    status: 'ACTIVE',
  });

  const [editTerminalConsoleData, setEditTerminalConsoleData] = useState<{ title: string, status: 'ACTIVE' | 'ARCHIVED' }>({
    title: '',
    status: 'ACTIVE'
  });

  const navigator = useNavigate();
  const client = generateClient() as any;
  
  const [consoleTerminals, setConsoleTerminals] = useState<UIConsoleTerminal[]>([]);
  const [contextProfiles, setContextProfiles] = useState<any[]>([]); 
  const [foundationModels, setFoundationModels] = useState<any[]>([]);

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  useEffect(() => {
    const terminalsSub = client.models.ConsoleTerminal.observeQuery({
      selectionSet: [
        'id', 'userId', 'title', 'totalTokensUsed', 'status', 'contextProfileId', 'createdAt', 'updatedAt',
        'contextProfile.*', 'messages.*'
      ]
    }).subscribe({
      next: (data: any) => {
        setConsoleTerminals(data.items as UIConsoleTerminal[]);
        setIsLoading(false);
      },
      error: (err: any) => {
        console.error("Error fetching terminals:", err);
        setIsLoading(false);
      }
    });

    const profilesSub = client.models.ContextProfile.observeQuery({
      selectionSet: ['id', 'name', 'description', 'llmModelId', 'temperature', 'systemPrompt', 'role', 'vectorCollection.*', 'foundationModel.*']
    }).subscribe({
      next: (data: any) => setContextProfiles(data.items.filter((p: any) => p.isActive !== false && p.role !== 'COLLABORATOR'))
    });

    const fmSub = client.models.FoundationModel.observeQuery().subscribe({
      next: (data: any) => setFoundationModels(data.items),
    });

    return () => {
      terminalsSub.unsubscribe();
      profilesSub.unsubscribe();
      fmSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (editConsoleTerminal) {
      setEditTerminalConsoleData({
        title: editConsoleTerminal.title,
        status: editConsoleTerminal.status
      });
    }
  }, [editConsoleTerminal]);
    
  const filterOptions = [
    { label: 'Session Title', value: 'title' },
    { label: 'Session Unique ID', value: 'id' },
    { label: 'Context Profile', value: 'contextProfile' },
    { label: 'Messages', value: 'messages' },
    { label: 'Status', value: 'status' },
    { label: 'Date', value: 'createdAt' },
  ];

  const filteredTerminals = useMemo(() => {
    if (!searchTerm.trim()) return consoleTerminals;
    const lowerTerm = searchTerm.toLowerCase();

    return consoleTerminals.filter(terminal => {
      switch (searchBy) {
        case 'title': return terminal.title?.toLowerCase().includes(lowerTerm);
        case 'id': return terminal.id?.toLowerCase().includes(lowerTerm);
        case 'contextProfile': return terminal.contextProfile?.name?.toLowerCase().includes(lowerTerm);
        case 'messages': return terminal.messages?.some(msg => msg.content?.toLowerCase().includes(lowerTerm)) || false;
        case 'status': return terminal.status?.toLowerCase().includes(lowerTerm);
        case 'createdAt':
          const dateString = terminal.createdAt ? new Date(terminal.createdAt).toLocaleDateString() : '';
          return terminal.createdAt?.toLowerCase().includes(lowerTerm) || dateString.includes(lowerTerm);
        default: return true;
      }
    });
  }, [consoleTerminals, searchTerm, searchBy]);

  const columns: ColumnDef<UIConsoleTerminal>[] = [
    {
      header: 'RAG Session',
      accessor: 'title',
      sortable: true,
      render: (row) => {
        const linkedProfile = contextProfiles.find(p => p.id === row.contextProfileId) || row.contextProfile;
        const linkedModel = foundationModels.find(m => m.id === linkedProfile?.llmModelId) || linkedProfile?.foundationModel;
        return (
          <div className="tbl-cell-user">
            <img src={getModelIcon(linkedModel?.apiIdentifier)} alt={linkedModel?.name || 'AI Model'} />
            <div className="user-info">
              <span className="primary-text">{row.title}</span>
              <span className="secondary-text">{row.id}</span>
              <span className="secondary-text">{row.userId ? row.userId.split('@')[0] : 'Anonymous'}</span>
            </div>
          </div>
        );
      }
    },
    {
      header: 'Context',
      accessor: 'totalTokensUsed',
      sortable: true,
      render: (row) => (
        <div className="tbl-cell-stacked">
          <span className="primary-text">{row.contextProfile?.name || 'Unlinked Profile'}</span>
          <span className="secondary-text">{row.messages?.length || 0} Messages</span>
          <span className="secondary-text">{row.totalTokensUsed?.toLocaleString() || 0} Tokens Used</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (row) => {
        const badgeClass = row.status === 'ACTIVE' ? 'success' : 'warning';
        return <span className={`tbl-badge ${badgeClass}`}>{row.status}</span>;
      }
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="tbl-action-group">
          <button 
            className="tbl-action-btn view-btn" 
            onClick={() => {
              if (row.status === 'ACTIVE') {
                navigator(`/console-terminal/session/${row.id}`);
              } else {
                setVisibleTranscriptCount(20); // Reset count on open
                setViewConsoleTerminal(row);
                setIsViewModalOpen(true);
              }
            }}
            style={{ color: row.status === 'ACTIVE' ? '#10b981' : undefined, fontWeight: row.status === 'ACTIVE' ? 600 : 400 }}
          >
            {row.status === 'ACTIVE' ? 'Resume' : 'Review'}
          </button>
          <button className="tbl-action-btn edit-btn" onClick={() => { 
            setVisibleTranscriptCount(20); // Reset count on open
            setEditConsoleTerminal(row); 
            setIsEditModalOpen(true); 
          }}>Emend</button>
          <button className="tbl-action-btn delete-btn" onClick={() => { setDeleteConsoleTerminal(row); setIsDeleteModalOpen(true); }}>Delete</button>
        </div>
      )
    }
  ];
    
  const selectedProfile = useMemo(() => {
      return contextProfiles.find(p => p.id === newConsoleTerminalData.contextProfileId);
  }, [newConsoleTerminalData.contextProfileId, contextProfiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setNewConsoleTerminalData(prev => ({ ...prev, [name]: value }));
  };

  const normalizedNewTitle = newConsoleTerminalData.title?.trim().toLowerCase() || '';
  const isTitleDuplicate = normalizedNewTitle !== '' && consoleTerminals.some(terminal => terminal.title.toLowerCase() === normalizedNewTitle);
  const isNewConsoleTerminalValid = newConsoleTerminalData.title?.trim() !== '' && newConsoleTerminalData.contextProfileId !== '' && !isTitleDuplicate;

  const handleStartSession = async () => {
    if (!selectedProfile) return;
    if (isTitleDuplicate) { alert("A Terminal Session with this title already exists."); return; }
    
    try {
      const { username, userId } = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const { data: newTerminal, errors } = await client.models.ConsoleTerminal.create({
        title: newConsoleTerminalData.title!.trim(),
        contextProfileId: newConsoleTerminalData.contextProfileId,
        status: 'ACTIVE',
        totalTokensUsed: 0,
        userId: attributes.email || userId || username || 'Anonymous'
      });

      if (errors) throw new Error(errors[0].message);
      
      setNewConsoleTerminalData({ title: '', contextProfileId: '', status: 'ACTIVE' });
      setIsCreateModalOpen(false);
      navigator(`/console-terminal/session/${newTerminal.id}`);
    } catch (error) {
      console.error('Failed to create terminal session', error);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditTerminalConsoleData(prev => ({ ...prev, [name]: value as any }));
  };

  const isEditValid = editTerminalConsoleData.title.trim() !== '';

  const handleEditSubmit = async () => {
    if (!editConsoleTerminal?.id) return;
    try {
      const { errors } = await client.models.ConsoleTerminal.update({
        id: editConsoleTerminal.id,
        title: editTerminalConsoleData.title,
        status: editTerminalConsoleData.status,
        updatedBy: getUserEmail ? await getUserEmail() : 'Unknown User'
      });
      if (errors) throw new Error(errors[0].message);
      setIsEditModalOpen(false);
      setEditConsoleTerminal(null);
    } catch (error) {
      console.error("Failed to update terminal metadata:", error);
    }
  };

  const handleDeleteConsoleTerminal = async () => {
    if (!deleteConsoleTerminal?.id) return;
    try {
      const { errors } = await client.models.ConsoleTerminal.delete({ id: deleteConsoleTerminal.id });
      if (errors) throw new Error(errors[0].message);
      setIsDeleteModalOpen(false);
      setDeleteConsoleTerminal(null);
    } catch (error) {
      console.error("Failed to delete console terminal:", error);
    }
  };

  const renderTranscript = (terminal: UIConsoleTerminal | null) => {
    if (!terminal?.messages || terminal.messages.length === 0) {
      return (
        <div style={{ margin: 'auto', textAlign: 'center', color: darkMode ? '#6b7280' : '#9ca3af' }}>
          <p>No messages were recorded for this session.</p>
        </div>
      );
    }

    const sortedMessages = [...terminal.messages].sort((a, b) => 
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    const visibleMessages = sortedMessages.slice(-visibleTranscriptCount);
    const hasMore = sortedMessages.length > visibleTranscriptCount;

    return (
      <>
        {hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <button
              onClick={() => setVisibleTranscriptCount(prev => prev + 20)}
              style={{
                background: 'none', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                borderRadius: '999px', padding: '0.4rem 1rem', fontSize: '0.75rem', 
                color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <i className="fa-solid fa-arrow-up"></i> Load Previous Messages
            </button>
          </div>
        )}

        {visibleMessages.map((msg, index) => {
          const isUser = msg.role === 'USER';
          const avatarName = isUser ? (terminal.userId?.split('@')[0] || 'Anonymous') : (terminal.contextProfile?.name || 'Vanguard AI');
          const initials = getInitials(avatarName);

          return (
            <div 
              key={msg.id} 
              style={{ 
                display: 'flex', 
                gap: '1rem', 
                alignItems: 'flex-end',
                alignSelf: isUser ? 'flex-end' : 'flex-start', 
                maxWidth: '85%',
                opacity: 0, 
                animation: 'bubbleFadeIn 0.4s ease-out forwards',
                animationDelay: `${index * 0.05}s`
              }}
            >
              {!isUser && (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: darkMode ? '#374151' : '#e5e7eb',
                  color: darkMode ? '#f9fafb' : '#111827',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 'bold', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`
                }}>
                  {initials}
                </div>
              )}

              <div style={{
                backgroundColor: isUser ? '#2563eb' : (darkMode ? '#1f2937' : '#ffffff'),
                color: isUser ? '#ffffff' : (darkMode ? '#f9fafb' : '#111827'),
                border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                padding: '1rem 1.25rem', 
                borderRadius: '1rem',
                borderBottomRightRadius: isUser ? '0.25rem' : '1rem',
                borderBottomLeftRadius: !isUser ? '0.25rem' : '1rem',
                boxShadow: isUser ? '0 4px 6px -1px rgba(37, 99, 235, 0.2)' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ fontSize: '0.7rem', opacity: isUser ? 0.8 : 0.5, marginBottom: '0.4rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                  {avatarName} • {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                
                <div style={{ fontSize: '0.925rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>

                {msg.contextSources && msg.contextSources.length > 0 && (
                  <div style={{ 
                    marginTop: '1rem', paddingTop: '0.75rem', 
                    borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : (darkMode ? '#374151' : '#e5e7eb')}`, 
                    fontSize: '0.75rem', 
                    color: isUser ? '#bfdbfe' : (darkMode ? '#9ca3af' : '#6b7280') 
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Retrieved Artifacts:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {msg.contextSources.map((source: string, idx: number) => {
                        const isMedia = source.toLowerCase().includes('media') || source.toLowerCase().includes('asset');
                        return (
                          <span key={idx} style={{ 
                            padding: '0.25rem 0.5rem', 
                            backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : (darkMode ? '#111827' : '#f3f4f6'), 
                            borderRadius: '0.25rem', 
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            border: isUser ? 'none' : `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`
                          }}>
                            {isMedia ? '📸' : '📄'} {source}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: '#1d4ed8', color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #1e40af'
                }}>
                  {initials}
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  return(
    <>
      <style>
        {`
          @keyframes bubbleFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>

     <TitleRibbon title="Console Terminals" darkMode={darkMode} typewriterFX textAlignment="right"/>
     <SearchRibbon 
        darkMode={darkMode} recordCount={filteredTerminals.length} recordLabel="Console Terminals"
        searchTerm={searchTerm} onSearchChange={setSearchTerm} selectedFilter={searchBy}
        onFilterChange={setSearchBy} filterOptions={filterOptions}
      />
      <div style={{ padding: '2rem' }}>
        <DataTable 
          columns={columns} data={filteredTerminals} darkMode={darkMode} selectable={true}
          isLoading={isLoading} initialSort={{ key: 'createdAt', direction: 'desc' }}
          pagination={true} defaultPageSize={10} pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
      <FAButton darkMode={darkMode} onClick={() => setIsCreateModalOpen(true)} 
        icon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox={"0 0 24 24"}><path d="M4.5 11h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5C3.67 3 3 3.67 3 4.5v5c0 .83.67 1.5 1.5 1.5M5 5h4v4H5zm14.5-2h-5c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5M19 9h-4V5h4zM4.5 21h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5c-.83 0-1.5.67-1.5 1.5v5c0 .83.67 1.5 1.5 1.5m.5-6h4v4H5zm13-2h-2v3h-3v2h3v3h2v-3h3v-2h-3z"></path></svg>} 
      />

      <ExtraLargeModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Terminal Audit Log: ${viewConsoleTerminal?.title}`}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem', display: 'inline-block', verticalAlign: 'text-bottom' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        }
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setIsViewModalOpen(false)}
              style={{ 
                padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: darkMode ? '#374151' : '#e5e7eb', 
                fontFamily: 'Bodoni Moda Variable, serif', border: 'none', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' 
              }}
            >
              Close Log
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '2rem', height: '65vh', minHeight: '450px' }}>
          <div style={{ 
            flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem', 
            borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingRight: '1.5rem', 
            overflowY: 'auto', overflowX: 'hidden' 
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem', wordBreak: 'break-word' }}>
                  {viewConsoleTerminal?.title}
                </h3>
              </div>
              <div style={{ display: 'inline-block', padding: '0.15rem 0.5rem', backgroundColor: viewConsoleTerminal?.status === 'ACTIVE' ? (darkMode ? '#064e3b' : '#dcfce7') : (darkMode ? '#78350f' : '#ffedd5'), color: viewConsoleTerminal?.status === 'ACTIVE' ? (darkMode ? '#34d399' : '#166534') : (darkMode ? '#fbbf24' : '#9a3412'), fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>
                {viewConsoleTerminal?.status}
              </div>
            </div>

            <div style={{ 
              backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem', padding: '1.25rem'
            }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Session Metadata
              </h4>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Session ID</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#4b5563', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {viewConsoleTerminal?.id}
                </span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>User ID</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#4b5563', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {viewConsoleTerminal?.userId || 'Anonymous'}
                </span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Context Profile</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewConsoleTerminal?.contextProfile?.name || 'Unlinked Profile'}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Total Tokens Consumed</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewConsoleTerminal?.totalTokensUsed?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', paddingTop: '1rem' }}>
              <div>Created: {viewConsoleTerminal?.createdAt ? new Date(viewConsoleTerminal.createdAt).toLocaleString() : ''}</div>
              {viewConsoleTerminal?.updatedAt && <div>Last Updated: {new Date(viewConsoleTerminal.updatedAt).toLocaleString()}</div>}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, backgroundColor: darkMode ? '#111827' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {renderTranscript(viewConsoleTerminal)}
            </div>
          </div>
        </div>
      </ExtraLargeModal>

      <ExtraLargeModal
        isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}
        title="Start New RAG Session" icon={<i className="fa-regular fa-message"></i>} darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button onClick={() => setIsCreateModalOpen(false)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', fontFamily: 'Bodoni Moda Variable, serif', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}>Cancel</button>
            <button onClick={handleStartSession} disabled={!isNewConsoleTerminalValid} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#0B0B45', color: 'white', border: 'none', borderRadius: '4px', cursor: isNewConsoleTerminalValid ? 'pointer' : 'not-allowed', opacity: isNewConsoleTerminalValid ? 1 : 0.5, fontFamily: 'Bodoni Moda Variable, serif' }}>Launch Terminal</button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', minHeight: '300px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle(darkMode)}>Session Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" name="title" value={newConsoleTerminalData.title || ''} onChange={handleInputChange} placeholder="e.g., Debugging DynamoDB Schema" style={{ ...inputStyle(darkMode), borderColor: isTitleDuplicate ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db') }} />
              {isTitleDuplicate ? <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>A session with this title already exists.</p> : <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>A descriptive title to help you find this chat in your history.</p>}
            </div>
            <div>
              <label style={labelStyle(darkMode)}>Select Context Profile <span style={{ color: '#ef4444' }}>*</span></label>
              <select name="contextProfileId" value={newConsoleTerminalData.contextProfileId || ''} onChange={handleInputChange} style={inputStyle(darkMode)}>
                <option value="">-- Choose AI Personality --</option>
                {contextProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            {!selectedProfile ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: darkMode ? '#6b7280' : '#9ca3af' }}>
                <p>Select a Context Profile to view its Engine configuration.</p>
              </div>
            ) : (
              <div style={{ animation: 'overlayFadeIn 0.3s ease-out' }}>
                <h3 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827' }}>{selectedProfile.name}</h3>
                <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{selectedProfile.description}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider • Model</span>
                    <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>
                      {foundationModels.find(fm => fm.id === selectedProfile.llmModelId)?.provider} • {foundationModels.find(fm => fm.id === selectedProfile.llmModelId)?.name || selectedProfile.llmModelId}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modality</span>
                    <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: '#2563eb', fontWeight: 600 }}>
                      {foundationModels.find(fm => fm.id === selectedProfile.llmModelId)?.modality || 'UNKNOWN'}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>System Prompt Target</span>
                  <div style={{ backgroundColor: darkMode ? '#111827' : '#ffffff', padding: '1rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#4b5563', lineHeight: '1.5', maxHeight: '150px', overflowY: 'auto', fontFamily: 'monospace' }}>
                    {selectedProfile.systemPrompt}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ExtraLargeModal>

      <FullScreenModal
        isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}
        title={`Emend Terminal Session: ${editConsoleTerminal?.id || ''}`} darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, fontFamily: 'Bodoni Moda Variable, serif', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}>Cancel</button>
            <button onClick={handleEditSubmit} disabled={!isEditValid} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontFamily: 'Bodoni Moda Variable, serif', cursor: isEditValid ? 'pointer' : 'not-allowed', opacity: isEditValid ? 1 : 0.5 }}>Update Console Meta</button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '2rem', height: '100%', minHeight: '450px' }}>
          <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '1.5rem', borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, overflowY: 'auto', overflowX: 'hidden' }}>
            <div>
              <label style={labelStyle(darkMode)}>Session Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" name="title" value={editTerminalConsoleData.title} onChange={handleEditChange} style={inputStyle(darkMode)} />
            </div>
            <div>
              <label style={labelStyle(darkMode)}>Session Status</label>
              <select name="status" value={editTerminalConsoleData.status} onChange={handleEditChange} style={inputStyle(darkMode)}>
                <option value="ACTIVE">Active: Open Interaction</option>
                <option value="ARCHIVED">Archived: Read Only</option>
              </select>
            </div>
            {editConsoleTerminal && (
              <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`, marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Session Metadata</h4>
                <div style={{ marginBottom: '0.75rem' }}><span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>User ID</span><span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontFamily: 'monospace' }}>{editConsoleTerminal.userId || 'Anonymous'}</span></div>
                <div style={{ marginBottom: '0.75rem' }}><span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Context Profile</span><span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>{editConsoleTerminal.contextProfile?.name || 'Unlinked Profile'}</span></div>
                <div><span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Total Tokens Used</span><span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>{editConsoleTerminal.totalTokensUsed?.toLocaleString()}</span></div>
              </div>
            )}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', paddingBottom: '1rem' }}>
              <div>Created: {editConsoleTerminal?.createdAt ? new Date(editConsoleTerminal.createdAt).toLocaleString() : ''}</div>
              {editConsoleTerminal?.updatedAt && <div>Last Updated: {new Date(editConsoleTerminal.updatedAt).toLocaleString()}</div>}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Session Transcript</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Review the conversation history for this terminal. Chat logs cannot be edited directly.</p>
            </div>
            <div style={{ flex: 1, backgroundColor: darkMode ? '#111827' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1rem' }}>
              
              {renderTranscript(editConsoleTerminal)}

              {editTerminalConsoleData.status === 'ACTIVE' && (
                <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                  <button onClick={() => { navigator(`/console-terminal/session/${editConsoleTerminal?.id}`); }} style={{ width: '100%', padding: '1rem', backgroundColor: darkMode ? '#374151' : '#ffffff', border: `1px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: '0.5rem', color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'Bodoni Moda Variable, serif', fontWeight: 800, letterSpacing: '0.13em', fontSize: '0.875rem', transition: 'all 0.2s ease' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                    Resume Conversation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FullScreenModal>

      <BottomRightModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} icon={<i className="bx bx-trash" />} title="Delete Console Terminal" darkMode={darkMode} footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button className="bottom-right-modal-button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button><button className="bottom-right-modal-button" onClick={handleDeleteConsoleTerminal} disabled={false} style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: 1 }}>Confirm</button></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}>Deleting RAG Session: <strong><em>{deleteConsoleTerminal?.title}</em></strong> <em>{deleteConsoleTerminal?.id}</em> from database records.</p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}>Are you sure you want to proceed? This action cannot be undone.</p>
        </div>
      </BottomRightModal>
    </>
  );
}

export default TerminalConsoleUI;