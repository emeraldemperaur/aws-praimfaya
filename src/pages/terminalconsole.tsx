import { useEffect, useMemo, useState } from "react";
import FAButton from "../components/floatingactionbutton";
import TitleRibbon from "../components/titleribbon";
import SearchRibbon from "../components/searchribbon";
import type { ColumnDef } from "../components/datatable";
import type { ConsoleTerminal } from "../data/consoleterminal";
import novaIcon from '../assets/nova-icon.png';
import gptIcon from '../assets/gpt-oss-icon.png';
import DataTable from "../components/datatable";
import BottomRightModal from "../components/bottomrightmodal";
import { availableProfiles, seedDataConsoleTerminals } from "../data/seeddata";
import ExtraLargeModal from "../components/extralargemodal";
import FullScreenModal from "../components/fullscreenmodal";
import { useNavigate } from "react-router-dom";
import { inputStyle, labelStyle } from "../utils/voltaire";

const TerminalConsoleUI = ({darkMode}: {darkMode: boolean}) =>{
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('name');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewConsoleTerminal, setViewConsoleTerminal] = useState<ConsoleTerminal | null>(null);
  const [deleteConsoleTerminal, setDeleteConsoleTerminal] = useState<ConsoleTerminal | null>(null);
  const [newConsoleTerminalData, setNewConsoleTerminalData] = useState<ConsoleTerminal>({
    sessionId: '',
    userId: '',
    title: '',
    status: 'ACTIVE', 
    contextProfileId: '',
    messages: [],
    totalTokensUsed: 0,
    createdAt: new Date().toISOString(),
  });
  //const [recordsCount] = useState(1);
  const [editTerminalConsoleData, setEditTerminalConsoleData] = useState<{title: string, status: 'ACTIVE' | 'ARCHIVED'}>({
    title: '',
    status: 'ACTIVE'
  });
  const [editConsoleTerminal, setEditConsoleTerminal] = useState<ConsoleTerminal | null>(null);
  const navigator = useNavigate();

  useEffect(() => {
        document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
      }, 
      [darkMode]);

  useEffect(() => {
    if (editConsoleTerminal) {
      setEditTerminalConsoleData({
        title: editConsoleTerminal.title,
        status: editConsoleTerminal.status
      });
    }
  }, [editConsoleTerminal]);
    
  const filterOptions = [
    { label: 'Name', value: 'name' },
    { label: 'Context', value: 'context' },
    { label: 'Foundation Model', value: 'foundationModel' },
    { label: 'Creator', value: 'creator' },
    { label: 'Date Created', value: 'date' },
  ];

  const columns: ColumnDef<ConsoleTerminal>[] = [
        {
          header: 'RAG Session',
          accessor: 'session',
          render: (row) => (
            <div className="tbl-cell-user">
              <img src={row.contextProfile?.llmModelId.toLocaleLowerCase().includes('amazon') ? novaIcon : gptIcon} alt={row.contextProfile?.llmModelId} />
              <div className="user-info">
                <span className="primary-text">{row.title}</span>
                <span className="secondary-text">{row.sessionId}</span>
                <span className="secondary-text">{row.userId}</span>
              </div>
            </div>
          )
        },
        {
          header: 'Context',
          accessor: 'context',
          render: (row) => (
            <div className="tbl-cell-stacked">
              <span className="primary-text">{row.contextProfile?.name}</span>
              <span className="secondary-text">{row.messages?.length || 0} Messages</span>
              <span className="secondary-text">{row.totalTokensUsed || 0} Tokens Used</span>
            </div>
          )
        },
        {
          header: 'Status',
          accessor: 'status',
          render: (row) => {
            let badgeClass = 'info';
            if (row.status === 'ACTIVE') badgeClass = 'success';
            if (row.status === 'ARCHIVED') badgeClass = 'warning';
    
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
                    console.log('Navigating to live chat interface for session:', row.sessionId);
                    // TODO: Route to your chat page -> navigate(`/terminal/${row.sessionId}`)
                    navigator(`/console-terminal/session/${row.sessionId}`);
                  } else {
                    console.log('Opening read-only view modal for session:', row.sessionId);
                    setViewConsoleTerminal(row);
                    setIsViewModalOpen(true);
                  }
                }}
                style={{ 
                  color: row.status === 'ACTIVE' ? '#10b981' : undefined, 
                  fontWeight: row.status === 'ACTIVE' ? 600 : 400
                }}
              >
                {row.status === 'ACTIVE' ? 'Resume' : 'Review'}
              </button>
              <button 
                className="tbl-action-btn edit-btn" 
                onClick={() => {
                  setEditConsoleTerminal(row);
                  setIsEditModalOpen(true);
                }}
              >
                Emend
              </button>
              <button 
                className="tbl-action-btn delete-btn" 
                onClick={() => {
                  console.log('Delete button clicked for console terminal:', row.sessionId);
                  setDeleteConsoleTerminal(row);
                  setIsDeleteModalOpen(true);
                }}
              >
                Delete
              </button>
            </div>
          )
        }
      ];
    
  const selectedProfile = useMemo(() => {
      return availableProfiles.find(p => p.id === newConsoleTerminalData.contextProfileId);
    }, [newConsoleTerminalData.contextProfileId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setNewConsoleTerminalData(prev => ({ ...prev, [name]: value }));
  };

  const isNewConsoleTerminalValid = newConsoleTerminalData.title.trim() !== '' && newConsoleTerminalData.contextProfileId !== '';

  const handleStartSession = async () => {
    if (!selectedProfile) return;

    const newTerminalSession: Partial<ConsoleTerminal> = {
      // sessionId: UUID generated by backend
      // userId: Extracted from Cognito auth context on backend
      contextProfileId: newConsoleTerminalData.contextProfileId,
      title: newConsoleTerminalData.title,
      messages: [],
      totalTokensUsed: 0,
      status: 'ACTIVE',
    };

    console.log('Initializing Terminal Session:', newTerminalSession);
    // TODO: Send to API to create the session, then navigate to the chat interface
    
    // Reset and close
    setNewConsoleTerminalData({ 
      title: '', contextProfileId: '', sessionId: '', userId: '', 
      messages: [], totalTokensUsed: 0, status: 'ACTIVE', 
      createdAt: new Date().toISOString() });
    setIsCreateModalOpen(false);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditTerminalConsoleData(prev => ({ ...prev, [name]: value as any }));
  };

  const isEditValid = editTerminalConsoleData.title.trim() !== '';

  const handleEditSubmit = async () => {
    console.log('Saving Terminal Updates:', editConsoleTerminal?.sessionId, editTerminalConsoleData);
    // TODO: Add Amplify Data API call here
    setIsEditModalOpen(false);
  };
    

  const handleDeleteConsoleTerminal = () => {
      if (!deleteConsoleTerminal) return;

      console.log('Deleting console terminal:', deleteConsoleTerminal.sessionId);
      // Add API call here
      
      // Clear and close after submitting
      setDeleteConsoleTerminal(null);
      setIsDeleteModalOpen(false);
  };

  



    return(
    <>
     <TitleRibbon title="Console Terminals" darkMode={darkMode} typewriterFX textAlignment="right"/>
     <SearchRibbon 
              darkMode={darkMode}
              recordCount={seedDataConsoleTerminals.length}
              recordLabel="Console Terminals"
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedFilter={searchBy}
              onFilterChange={setSearchBy}
              filterOptions={filterOptions}
      />
      <div style={{ padding: '2rem' }}>
              <DataTable 
                columns={columns} 
                data={seedDataConsoleTerminals} 
                darkMode={darkMode} 
                selectable={true}
              />
      </div>
      <FAButton darkMode={darkMode} onClick={() => setIsCreateModalOpen(true)} 
      icon={
      <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox={"0 0 24 24"}>
        <path d="M4.5 11h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5C3.67 3 3 3.67 3 4.5v5c0 
        .83.67 1.5 1.5 1.5M5 5h4v4H5zm14.5-2h-5c-.83 0-1.5.67-1.5 1.5v5c0 
        .83.67 1.5 1.5 1.5h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5M19 
        9h-4V5h4zM4.5 21h5c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5h-5c-.83 0-1.5.67-1.5 1.5v5c0 
        .83.67 1.5 1.5 1.5m.5-6h4v4H5zm13-2h-2v3h-3v2h3v3h2v-3h3v-2h-3z"></path>
      </svg>} />
      
      {/* --- VIEW MODAL (Audit Log) --- */}
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
                padding: '0.75rem 1.5rem', 
                cursor: 'pointer', 
                backgroundColor: darkMode ? '#374151' : '#e5e7eb', 
                fontFamily: 'Bodoni Moda Variable, serif',
                border: 'none', 
                color: darkMode ? '#f9fafb' : '#111827', 
                borderRadius: '4px' 
              }}
            >
              Close Log
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '2rem', height: '65vh', minHeight: '450px' }}>
          
          <div style={{ 
            flex: '0 0 350px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem', 
            borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
            paddingRight: '1.5rem', 
            overflowY: 'auto',
            overflowX: 'hidden' // <-- Added explicit safeguard
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
              backgroundColor: darkMode ? '#1f2937' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem', 
              padding: '1.25rem'
            }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Session Metadata
              </h4>
              
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Session ID</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#4b5563', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {viewConsoleTerminal?.sessionId}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>User ID</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#4b5563', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {viewConsoleTerminal?.userId}
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

          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0, 
            minHeight: 0 
          }}>
            
            <div style={{ 
              flex: 1, 
              backgroundColor: darkMode ? '#111827' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem',
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {!viewConsoleTerminal?.messages || viewConsoleTerminal.messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: darkMode ? '#6b7280' : '#9ca3af' }}>
                  <p>No messages were recorded for this session.</p>
                </div>
              ) : (
                viewConsoleTerminal.messages.map((msg) => (
                  <div key={msg.id} style={{
                    alignSelf: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    backgroundColor: msg.role === 'USER' ? '#2563eb' : (darkMode ? '#374151' : '#ffffff'),
                    color: msg.role === 'USER' ? '#ffffff' : (darkMode ? '#f9fafb' : '#111827'),
                    border: msg.role === 'USER' ? 'none' : `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    borderBottomRightRadius: msg.role === 'USER' ? '0' : '0.5rem',
                    borderBottomLeftRadius: msg.role === 'ASSISTANT' || msg.role === 'SYSTEM' ? '0' : '0.5rem',
                  }}>
                    <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.7, textTransform: 'uppercase' }}>
                      {msg.role} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                    {msg.contextSources && msg.contextSources.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: `1px solid ${msg.role === 'USER' ? '#3b82f6' : (darkMode ? '#4b5563' : '#e5e7eb')}`, fontSize: '0.7rem', opacity: 0.8 }}>
                        Sources: {msg.contextSources.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>

        </div>
      </ExtraLargeModal>

      <ExtraLargeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Start New RAG Session"
        icon={<i className="fa-regular fa-message"></i>}
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              style={{ 
                padding: '0.75rem 1.5rem', 
                cursor: 'pointer', 
                backgroundColor: 'transparent', 
                fontFamily: 'Bodoni Moda Variable, serif',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827', 
                borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleStartSession}
              disabled={!isNewConsoleTerminalValid}
              style={{ 
                padding: '0.75rem 1.5rem', 
                backgroundColor: '#0B0B45', // Purple for terminal execution
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isNewConsoleTerminalValid ? 'pointer' : 'not-allowed',
                opacity: isNewConsoleTerminalValid ? 1 : 0.5,
                fontFamily: 'Bodoni Moda Variable, serif'
              }}
            >
              Launch Terminal
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', minHeight: '300px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#d1d5db' : '#374151' }}>
                Session Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                name="title"
                value={newConsoleTerminalData.title}
                onChange={handleInputChange}
                placeholder="e.g., Debugging DynamoDB Schema"
                style={inputStyle(darkMode)}
              />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                A descriptive title to help you find this chat in your history.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#d1d5db' : '#374151' }}>
                Select Context Profile <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select 
                name="contextProfileId"
                value={newConsoleTerminalData.contextProfileId}
                onChange={handleInputChange}
                style={inputStyle(darkMode)}
              >
                <option value="">-- Choose AI Personality --</option>
                {availableProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div style={{ 
            backgroundColor: darkMode ? '#1f2937' : '#f9fafb', 
            border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
            borderRadius: '0.5rem', 
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {!selectedProfile ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: darkMode ? '#6b7280' : '#9ca3af' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '48px', height: '48px', margin: '0 auto 1rem' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <p>Select a Context Profile to view its configuration.</p>
              </div>
            ) : (
              <div style={{ animation: 'overlayFadeIn 0.3s ease-out' }}>
                <h3 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827' }}>
                  {selectedProfile.name}
                </h3>
                <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                  {selectedProfile.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</span>
                    <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', borderRadius: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151' }}>
                      {selectedProfile.llmModelId}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperature</span>
                    <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151' }}>
                      {selectedProfile.temperature?.toFixed(2)}
                    </span>
                  </div>
                  {selectedProfile.vectorCollectionId && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>RAG Enabled</span>
                      <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151' }}>
                        Linked to: {selectedProfile.vectorCollection?.name || 'Unknown Collection'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    System Prompt Target
                  </span>
                  <div style={{ 
                    backgroundColor: darkMode ? '#111827' : '#ffffff', 
                    padding: '1rem', 
                    borderRadius: '0.375rem',
                    border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                    fontSize: '0.875rem',
                    color: darkMode ? '#d1d5db' : '#4b5563',
                    lineHeight: '1.5',
                    maxHeight: '150px',
                    overflowY: 'auto'
                  }}>
                    {selectedProfile.systemPrompt}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      </ExtraLargeModal>

      <FullScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Emend Terminal Session: ${editConsoleTerminal?.sessionId || ''}`}
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button 
              onClick={() => setIsEditModalOpen(false)}
              style={{ 
                padding: '0.75rem 1.5rem', 
                cursor: 'pointer', backgroundColor: 'transparent', 
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                fontFamily: 'Bodoni Moda Variable, serif',
                color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleEditSubmit}
              disabled={!isEditValid}
              style={{ 
                padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px',
                fontFamily: 'Bodoni Moda Variable, serif',
                cursor: isEditValid ? 'pointer' : 'not-allowed', opacity: isEditValid ? 1 : 0.5
              }}
            >
              Update Console Meta
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: '2rem', height: '100%', minHeight: '450px' }}>
          
          <div style={{ 
            flex: '0 0 350px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem', 
            paddingRight: '1.5rem', 
            borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            
            <div>
              <label style={labelStyle(darkMode)}>Session Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                name="title"
                value={editTerminalConsoleData.title}
                onChange={handleEditChange}
                style={inputStyle(darkMode)}
              />
            </div>

            <div>
              <label style={labelStyle(darkMode)}>Session Status</label>
              <select 
                name="status"
                value={editTerminalConsoleData.status}
                onChange={handleEditChange}
                style={inputStyle(darkMode)}
              >
                <option value="ACTIVE">ACTIVE - Open for interaction</option>
                <option value="ARCHIVED">ARCHIVED - Read-only history</option>
              </select>
            </div>

            {editConsoleTerminal && (
              <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`, marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Session Metadata</h4>
                
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>User ID</span>
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontFamily: 'monospace' }}>{editConsoleTerminal.userId || 'Unknown'}</span>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Context Profile</span>
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>{editConsoleTerminal.contextProfile?.name || 'Unlinked Profile'}</span>
                </div>

                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Total Tokens Used</span>
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>{editConsoleTerminal.totalTokensUsed?.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', paddingBottom: '1rem' }}>
              <div>Created: {editConsoleTerminal?.createdAt ? new Date(editConsoleTerminal.createdAt).toLocaleString() : ''}</div>
              {editConsoleTerminal?.updatedAt && <div>Last Updated: {new Date(editConsoleTerminal.updatedAt).toLocaleString()}</div>}
            </div>
          </div>

          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0, 
            minHeight: 0 
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Session Transcript</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Review the conversation history for this terminal. Chat logs cannot be edited directly to preserve audit integrity.
              </p>
            </div>

            <div style={{ 
              flex: 1, 
              backgroundColor: darkMode ? '#111827' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem',
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              
              {!editConsoleTerminal?.messages || editConsoleTerminal.messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: darkMode ? '#6b7280' : '#9ca3af' }}>
                  <p>No messages have been sent in this session yet.</p>
                </div>
              ) : (
                editConsoleTerminal.messages.map((msg) => (
                  <div key={msg.id} style={{
                    alignSelf: msg.role === 'USER' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    backgroundColor: msg.role === 'USER' ? '#2563eb' : (darkMode ? '#374151' : '#ffffff'),
                    color: msg.role === 'USER' ? '#ffffff' : (darkMode ? '#f9fafb' : '#111827'),
                    border: msg.role === 'USER' ? 'none' : `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    borderBottomRightRadius: msg.role === 'USER' ? '0' : '0.5rem',
                    borderBottomLeftRadius: msg.role === 'ASSISTANT' || msg.role === 'SYSTEM' ? '0' : '0.5rem',
                  }}>
                    <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.7, textTransform: 'uppercase' }}>
                      {msg.role} • {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                    {msg.contextSources && msg.contextSources.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: `1px solid ${msg.role === 'USER' ? '#3b82f6' : (darkMode ? '#4b5563' : '#e5e7eb')}`, fontSize: '0.7rem', opacity: 0.8 }}>
                        Sources: {msg.contextSources.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}

              {editConsoleTerminal?.status === 'ACTIVE' && (
                <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                  <button 
                    onClick={() => {
                      console.log('Navigating to live chat interface for session:', editConsoleTerminal.sessionId);
                      // TODO: Route to your chat page -> navigate(`/terminal/${editConsoleTerminal.sessionId}`)
                      navigator(`/console-terminal/${editConsoleTerminal.sessionId}`);
                    }}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      backgroundColor: darkMode ? '#374151' : '#ffffff',
                      border: `1px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      borderRadius: '0.5rem',
                      color: darkMode ? '#d1d5db' : '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontFamily: 'Bodoni Moda Variable, serif',
                      fontWeight: 800,
                      letterSpacing: '0.13em',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = darkMode ? '#4b5563' : '#f3f4f6';
                      e.currentTarget.style.color = darkMode ? '#ffffff' : '#111827';
                      e.currentTarget.style.borderColor = '#2563eb';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#ffffff';
                      e.currentTarget.style.color = darkMode ? '#d1d5db' : '#4b5563';
                      e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db';
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                    Resume Conversation
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      </FullScreenModal>

      <BottomRightModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        icon={<i className="bx bx-trash" />}
        title="Delete Console Terminal"
        darkMode={darkMode}
        
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="bottom-right-modal-button" 
              onClick={() => setIsDeleteModalOpen(false)}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              className="bottom-right-modal-button"
              onClick={handleDeleteConsoleTerminal}
              disabled={false}
              style={{ 
                padding: '0.5rem 1rem', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: 1
              }}
            >
              Confirm
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}>
            Deleting RAG Session: <strong><em>{deleteConsoleTerminal?.title}</em></strong> <em>{deleteConsoleTerminal?.sessionId}</em> from database records. 
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}> 
            Are you sure you want to proceed? 
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}> 
            This action cannot be undone.
          </p>
        </div>
      </BottomRightModal>
    </>
    )
}

export default TerminalConsoleUI;