import { useEffect, useState, useMemo } from "react";
import FAButton from "../components/floatingactionbutton";
import { generateClient } from "aws-amplify/api";
import TitleRibbon from "../components/titleribbon";
import SearchRibbon from "../components/searchribbon";
import type { ColumnDef } from "../components/datatable";
import DataTable from "../components/datatable";
import BottomRightModal from "../components/bottomrightmodal";
import ExtraLargeModal from "../components/extralargemodal";
import FullScreenModal from "../components/fullscreenmodal";
import { getModelIcon, MODEL_FAMILY_DESCRIPTIONS } from "../utils/voltaire";
import type { UIContextProfile } from "../data/contextprofile";
import { getUserEmail } from "../utils/asimov";

const DEFAULT_PROFILE_STATE = {
  name: '',
  description: '',
  systemPrompt: '',
  vectorCollectionId: '',
  llmModelId: '',
  temperature: 0.7,
  isActive: true,
};

const ContextProfilesUI = ({ darkMode }: { darkMode: boolean }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('name');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewContextProfile, setViewContextProfile] = useState<UIContextProfile | null>(null);
  const [editContextProfile, setEditContextProfile] = useState<UIContextProfile | null>(null);
  const [deleteContextProfile, setDeleteContextProfile] = useState<UIContextProfile | null>(null);
  const [newContextProfileData, setNewContextProfileData] = useState<Partial<UIContextProfile>>(DEFAULT_PROFILE_STATE);
  const [editContextProfileData, setEditContextProfileData] = useState<Partial<UIContextProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const client = generateClient() as any;
  const contextProfilesClient = client.models.ContextProfile;
  const [contextProfiles, setContextProfiles] = useState<UIContextProfile[]>([]);
  const [foundationModels, setFoundationModels] = useState<any[]>([]);
  const [vectorCollections, setVectorCollections] = useState<any[]>([]);
  
  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode, contextProfiles.length]);

  useEffect(() => {
    const fmSub = client.models.FoundationModel.observeQuery().subscribe({
      next: (data: any) => setFoundationModels(data.items),
      error: (err: any) => console.error("Error fetching models:", err)
    });

    const vcSub = client.models.VectorCollection.observeQuery().subscribe({
      next: (data: any) => setVectorCollections(data.items),
      error: (err: any) => console.error("Error fetching collections:", err)
    });

    return () => {
      fmSub.unsubscribe();
      vcSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const contextProfilesSubscription = contextProfilesClient.observeQuery({
      selectionSet: [
        'id', 'name', 'description', 'systemPrompt', 
        'vectorCollectionId', 'llmModelId', 'temperature', 
        'isActive', 'createdAt', 'updatedAt', 
        'vectorCollection.*',
        'foundationModel.*',
        'terminals.*'
      ]
    }).subscribe({
      next: (data: any) => {
        setContextProfiles(data.items as UIContextProfile[]);
        setIsLoading(false);
      },
      error: (err: any) => {
        console.error("Error fetching profiles:", err);
        setIsLoading(false);
      }
    });

    return () => contextProfilesSubscription.unsubscribe();
  }, []);
  
  useEffect(() => {
    if (editContextProfile) {
      setEditContextProfileData({
        name: editContextProfile.name,
        description: editContextProfile.description || '',
        systemPrompt: editContextProfile.systemPrompt,
        vectorCollectionId: editContextProfile.vectorCollectionId || '',
        llmModelId: editContextProfile.llmModelId,
        temperature: editContextProfile.temperature ?? 0.7,
        isActive: editContextProfile.isActive ?? true,
      });
    }
  }, [editContextProfile]);

  const filterOptions = [
    { label: 'Name', value: 'name' },
    { label: 'Description', value: 'description' },
    { label: 'System Prompt', value: 'systemPrompt' },
    { label: 'Foundation Model', value: 'foundationModel' },
    { label: 'Temperature', value: 'temperature' },
    { label: 'Created By', value: 'createdBy' },
    { label: 'Date', value: 'createdAt' },
  ];

  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return contextProfiles;
    const lowerTerm = searchTerm.toLowerCase();

    return contextProfiles.filter(profile => {
      switch (searchBy) {
        case 'name':
          return profile.name?.toLowerCase().includes(lowerTerm);
        case 'description':
          return profile.description?.toLowerCase().includes(lowerTerm);
        case 'systemPrompt':
          return profile.systemPrompt?.toLowerCase().includes(lowerTerm);
        case 'foundationModel': {
          const fmName = foundationModels.find(fm => fm.id === profile.llmModelId)?.name || profile.foundationModel?.name || '';
          return fmName.toLowerCase().includes(lowerTerm);
        }
        case 'temperature':
          return profile.temperature?.toString().includes(lowerTerm);
        case 'createdBy':
          return profile.createdBy?.toLowerCase().includes(lowerTerm);
        case 'createdAt':
          const dateString = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '';
          return profile.createdAt?.toLowerCase().includes(lowerTerm) || dateString.includes(lowerTerm);
        default:
          return true;
      }
    });
  }, [contextProfiles, searchTerm, searchBy, foundationModels]);

  const columns: ColumnDef<UIContextProfile>[] = [
      {
        header: 'Name',
        accessor: 'name',
        sortable: true,
        render: (row) => {
          const linkedModel = foundationModels.find(fm => fm.id === row.llmModelId);
          const apiIdentifier = linkedModel?.apiIdentifier || row.foundationModel?.apiIdentifier;
          return (
            <div className="tbl-cell-user">
              <img src={getModelIcon(apiIdentifier)} alt={row.name} />
              <div className="user-info">
                <span className="primary-text">{row.name}</span>
                <span className="secondary-text">{row.description}</span>
              </div>
            </div>
          );
        }
      },
      {
        header: 'Context Boundary',
        accessor: 'temperature',
        sortable: true,
        render: (row) => (
          <div className="tbl-cell-stacked">
            <span className="primary-text">{row.temperature || 0}° <a className="secondary-text">ᵀᵉᵐᵖᵉʳᵃᵗᵘʳᵉ</a></span>
            <span className="secondary-text">{row.systemPrompt.replace(/\s/g, "").length > 0 ? `${row.systemPrompt.replace(/\s/g, "").length} ˡᵉᵗᵗᵉʳ RAG prompt` : 'No system prompt'}</span>
          </div>
        )
      },
      {
        header: 'Vector Embeddings',
        accessor: 'vectorCollectionId',
        sortable: false,
        render: (row) => {
          let collectionBadgeClass = 'info';
          if (row.isActive === true) collectionBadgeClass = 'success';
          if (row.isActive === false) collectionBadgeClass = 'danger';
          if (!row.vectorCollection) collectionBadgeClass = 'warning'; 
          const linkedCollection = vectorCollections.find(vc => vc.id === row.vectorCollectionId);
          const collectionName = linkedCollection?.name || row.vectorCollection?.name || 'No Vector Collection';
  
          return (
            <span className={`tbl-badge ${collectionBadgeClass}`}>
              {collectionName}
            </span>
          );
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
                setViewContextProfile(row);
                setIsViewModalOpen(true);
              }}
            >
              View
            </button>
            <button 
              className="tbl-action-btn edit-btn" 
              onClick={() => {
                setEditContextProfile(row);
                setIsEditModalOpen(true);
              }}
            >
              Edit
            </button>
            <button 
              className="tbl-action-btn delete-btn" 
              onClick={() => {
                setDeleteContextProfile(row);
                setIsDeleteModalOpen(true);
            }}
            >
              Delete
            </button>
          </div>
        )
      }
    ];
  
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewContextProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewContextProfileData((prev) => ({ ...prev, [name]: parseFloat(value) }));
  };

  const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNewContextProfileData((prev) => ({ ...prev, [name]: checked }));
  };

  const normalizedNewName = newContextProfileData.name?.trim().toLowerCase() || '';
  const isNameDuplicate = normalizedNewName !== '' && contextProfiles.some(
    profile => profile.name.toLowerCase() === normalizedNewName
  );

  const isContextProfileValid = newContextProfileData.name?.trim() !== '' && 
                        newContextProfileData.systemPrompt?.trim() !== '' && 
                        newContextProfileData.llmModelId?.trim() !== '' &&
                        !isNameDuplicate;

  const handleCreateSubmit = async () => {
    if (isNameDuplicate) {
      alert("A Context Profile with this name already exists. Please choose a unique name.");
      return;
    }
    try {
      const { data: newProfile, errors } = await contextProfilesClient.create({
        name: newContextProfileData.name!.trim(),
        description: newContextProfileData.description?.trim() || null,
        systemPrompt: newContextProfileData.systemPrompt!.trim(),
        llmModelId: newContextProfileData.llmModelId!,
        vectorCollectionId: newContextProfileData.vectorCollectionId ? newContextProfileData.vectorCollectionId : undefined,
        temperature: newContextProfileData.temperature,
        isActive: newContextProfileData.isActive,
        createdBy: getUserEmail ? await getUserEmail() : 'Unknown User',
      });
      
      if (errors) throw new Error(errors[0].message);
      setContextProfiles(prev => {
        const alreadyExists = prev.some(profile => profile.id === newProfile.id);
        if (alreadyExists) return prev;
        return [newProfile, ...prev];
      });
      setIsCreateModalOpen(false);
      setNewContextProfileData(DEFAULT_PROFILE_STATE);
    } catch (error) {
      console.error("Failed to create profile", error);
    }
  };

  const handleEditTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditContextProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditContextProfileData(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const handleEditToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditContextProfileData(prev => ({ ...prev, [name]: checked }));
  };

  const isEditValid = editContextProfileData.name?.trim() !== '' && 
                      editContextProfileData.systemPrompt?.trim() !== '' && 
                      editContextProfileData.llmModelId?.trim() !== '';

  const handleEditSubmit = async () => {
    if (!editContextProfile?.id) return;
    try {
      const { data: updatedProfile, errors } = await contextProfilesClient.update({
        id: editContextProfile.id,
        name: editContextProfileData.name!.trim(),
        description: editContextProfileData.description?.trim() || null,
        systemPrompt: editContextProfileData.systemPrompt!.trim(),
        llmModelId: editContextProfileData.llmModelId!,
        vectorCollectionId: editContextProfileData.vectorCollectionId ? editContextProfileData.vectorCollectionId : undefined,
        temperature: editContextProfileData.temperature,
        isActive: editContextProfileData.isActive,
        updatedBy: getUserEmail ? await getUserEmail() : 'Unknown User',
      });
      if (errors) throw new Error(errors[0].message);
      setContextProfiles(prev => prev.map(item => 
        item.id === updatedProfile.id ? updatedProfile : item
      ));
      setIsEditModalOpen(false);
      setEditContextProfile(null);
    } catch (error) {
      console.error("Failed to update profile", error);
    }
  };

  const handleDeleteContextProfile = async () => {
    if (!deleteContextProfile?.id) return;
    try {
      const { errors } = await contextProfilesClient.delete({
        id: deleteContextProfile.id
      });

      if (errors) throw new Error(errors[0].message);
      setContextProfiles(prev => prev.filter(item => item.id !== deleteContextProfile.id));
      setDeleteContextProfile(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Failed to delete profile", error);
    }
  };

  const selectedCreateModel = foundationModels.find(m => m.id === newContextProfileData.llmModelId);
  const selectedCreateModelDescription = selectedCreateModel?.provider 
    ? MODEL_FAMILY_DESCRIPTIONS[selectedCreateModel.provider] 
    : null;

  const selectedEditModel = foundationModels.find(m => m.id === editContextProfileData.llmModelId);
  const selectedEditModelDescription = selectedEditModel?.provider 
  ? MODEL_FAMILY_DESCRIPTIONS[selectedEditModel.provider] 
  : null;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#f9fafb' : '#111827',
    fontFamily: 'inherit',
    boxSizing: 'border-box' 
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 500,
    fontSize: '0.875rem',
    color: darkMode ? '#d1d5db' : '#374151'
  };

  return(
    <>
      <TitleRibbon title="Context Profiles" darkMode={darkMode} typewriterFX textAlignment="right"/>
      <SearchRibbon 
        darkMode={darkMode}
        recordCount={filteredProfiles.length}
        recordLabel="Context Profiles"
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedFilter={searchBy}
        onFilterChange={setSearchBy}
        filterOptions={filterOptions}
      />
      <div style={{ padding: '2rem' }}>
      <DataTable 
          columns={columns} 
          data={filteredProfiles} 
          darkMode={darkMode} 
          selectable={true}
          isLoading={isLoading}
          initialSort={{ key: 'createdAt', direction: 'desc' }}
          pagination={true}
          defaultPageSize={6}
          pageSizeOptions={[6, 10, 25, 50, 100]}
      />
      </div>
      <FAButton darkMode={darkMode} onClick={() => setIsCreateModalOpen(true)} icon={
        <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox={"0 0 24 24"}>
          <path d="M21.57 2.18a.98.98 0 0 0-.92-.11C7.29 7.2 4.15 20.71 4.02 21.28l1.95.43s.36-1.55 
          1.31-3.72H11c6.07 0 11-4.93 11-11V3c0-.33-.16-.64-.43-.82M20 7c0 4.96-4.04 9-9 9H8.24C10.26 
          12.16 13.87 7.31 20 4.5zM5 10h2V7h3V5H7V2H5v3H2v2h3z"></path>
        </svg>} />

      <ExtraLargeModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Inspect Context Profile: ${viewContextProfile?.name}`}
        icon={<i className="bx bx-user-circle"></i>}
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
              Close
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', minHeight: '450px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflowX: 'hidden' }}>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem' }}>
                  {viewContextProfile?.name}
                </h3>
                {viewContextProfile?.isActive ? (
                  <span style={{ padding: '0.15rem 0.5rem', backgroundColor: darkMode ? '#064e3b' : '#dcfce7', color: darkMode ? '#34d399' : '#166534', fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>ACTIVE</span>
                ) : (
                  <span style={{ padding: '0.15rem 0.5rem', backgroundColor: darkMode ? '#7f1d1d' : '#fee2e2', color: darkMode ? '#f87171' : '#991b1b', fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>INACTIVE</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.5 }}>
                {viewContextProfile?.description || 'No description provided.'}
              </p>
            </div>

            <div style={{ 
              backgroundColor: darkMode ? '#1f2937' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem', 
              padding: '1.25rem'
            }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Engine Specifications
              </h4>
              
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Foundation Model</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewContextProfile?.foundationModel?.name || 'Unknown Model'}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Temperature</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewContextProfile?.temperature?.toFixed(2) || '0.00'} 
                  <span style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 400 }}>
                    ({(viewContextProfile?.temperature || 0) < 0.3 ? 'Precise/Analytical' : (viewContextProfile?.temperature || 0) > 0.7 ? 'Creative/Dynamic' : 'Balanced'})
                  </span>
                </span>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Vector Collection (RAG)</span>
                {viewContextProfile?.vectorCollectionId ? (
                  <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                    {viewContextProfile.vectorCollection?.name || viewContextProfile.vectorCollectionId}
                  </span>
                ) : (
                  <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic' }}>
                    No Document Retrieval Linked
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              <div>Created: {viewContextProfile?.createdAt ? new Date(viewContextProfile.createdAt).toLocaleString() : ''}</div>
              {viewContextProfile?.updatedAt && <div>Last Updated: {new Date(viewContextProfile.updatedAt).toLocaleString()}</div>}
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflowX: 'hidden' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>System Prompt</h4>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                The strict behavioral instructions passed to the LLM.
              </p>
            </div>

            <div style={{ 
              flexGrow: 1, 
              backgroundColor: darkMode ? '#111827' : '#ffffff', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem',
              padding: '1.25rem',
              color: darkMode ? '#d1d5db' : '#4b5563',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace' 
            }}>
              {viewContextProfile?.systemPrompt || 'No prompt defined.'}
            </div>
          </div>

        </div>
      </ExtraLargeModal>

      <ExtraLargeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Context Profile"
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateSubmit}
              disabled={!isContextProfileValid}
              style={{ 
                padding: '0.75rem 1.5rem', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isContextProfileValid ? 'pointer' : 'not-allowed',
                opacity: isContextProfileValid ? 1 : 0.5
              }}
            >
              Save Profile
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflowX: 'hidden' }}>
            <div>
              <label style={labelStyle}>Profile Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                name="name"
                value={newContextProfileData.name}
                onChange={handleTextChange}
                placeholder="e.g., Customer Support Agent"
                style={{
                  ...inputStyle,
                  borderColor: isNameDuplicate ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db')
                }}
              />
              {isNameDuplicate && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  A profile with this name already exists.
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>System Prompt <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea 
                name="systemPrompt"
                value={newContextProfileData.systemPrompt}
                onChange={handleTextChange}
                placeholder="You are a helpful AI assistant..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                This is the core identity and instruction set for the LLM.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea 
                name="description"
                value={newContextProfileData.description || ''}
                onChange={handleTextChange}
                placeholder="Internal notes about what this profile is used for..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflowX: 'hidden' }}>
            
            <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  name="isActive"
                  checked={newContextProfileData.isActive || false}
                  onChange={handleToggleChange}
                  style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500, color: darkMode ? '#f9fafb' : '#111827' }}>
                  Profile is Active
                </span>
              </label>
            </div>

            <div>
              <label style={labelStyle}>LLM Engine <span style={{ color: '#ef4444' }}>*</span></label>
              <select 
                name="llmModelId"
                value={newContextProfileData.llmModelId || ''}
                onChange={handleTextChange}
                style={inputStyle}
              >
                <option value="" disabled>Select a Foundation Model...</option>
                {foundationModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} 
                  </option>
                ))}
              </select>
              {selectedCreateModelDescription && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.75rem', 
                  backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', 
                  borderLeft: `3px solid ${darkMode ? '#60a5fa' : '#3b82f6'}`,
                  borderRadius: '0 0.375rem 0.375rem 0'
                }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#4b5563', lineHeight: 1.5 }}>
                    {selectedCreateModelDescription}
                  </p>
                </div>
                )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={labelStyle}>Temperature</label>
                <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>
                  {newContextProfileData.temperature?.toFixed(2)}
                </span>
              </div>
              <input 
                type="range" 
                name="temperature"
                min="0" max="1" step="0.05"
                value={newContextProfileData.temperature || 0}
                onChange={handleNumberChange}
                style={{ width: '100%', cursor: 'pointer', marginTop: '0.5rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', marginTop: '0.25rem' }}>
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <hr style={{ borderColor: darkMode ? '#4b5563' : '#e5e7eb', borderTopWidth: 1, borderBottomWidth: 0, margin: '0.5rem 0' }} />

            <div>
              <label style={labelStyle}>Linked Vector Collection (RAG)</label>
              <select 
                name="vectorCollectionId"
                value={newContextProfileData.vectorCollectionId || ''}
                onChange={handleTextChange}
                style={inputStyle}
              >
                <option value="">-- No Document Retrieval --</option>
                {vectorCollections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} {collection.vectorDimension ? `(${collection.vectorDimension}D)` : '(Multimodal Pool)'}
                  </option>
                ))}
              </select>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Link this profile to a Vector Collection to enable RAG.
              </p>
            </div>

          </div>

        </div>
      </ExtraLargeModal>

      <FullScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editContextProfile ? `Editing Context Profile: ${editContextProfile.name}` : 'Edit Context Profile'}
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button 
              onClick={() => setIsEditModalOpen(false)}
              style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleEditSubmit}
              disabled={!isEditValid}
              style={{ 
                padding: '0.75rem 1.5rem', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isEditValid ? 'pointer' : 'not-allowed',
                opacity: isEditValid ? 1 : 0.5
              }}
            >
              Save Changes
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', height: '100%' }}>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem', 
            paddingRight: '2rem',
            borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            overflowY: 'auto',
            minWidth: 0,         
            overflowX: 'hidden'  
          }}>
            
            <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="checkbox"
                  name="isActive"
                  checked={editContextProfileData.isActive || false}
                  onChange={handleEditToggleChange}
                  style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 500, color: darkMode ? '#f9fafb' : '#111827' }}>
                  Profile is Active
                </span>
              </label>
            </div>

            <div>
              <label style={labelStyle}>Profile Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                name="name"
                value={editContextProfileData.name || ''}
                onChange={handleEditTextChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea 
                name="description"
                value={editContextProfileData.description || ''}
                onChange={handleEditTextChange}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={labelStyle}>LLM Engine <span style={{ color: '#ef4444' }}>*</span></label>
              <select 
                disabled={false}
                name="llmModelId"
                value={editContextProfileData.llmModelId || ''}
                onChange={handleEditTextChange}
                style={inputStyle}
              >
                <option value="">Select a Foundation Model...</option>
                {foundationModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} 
                  </option>
                ))}
              </select>

              {selectedEditModelDescription && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.75rem', 
                  backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', 
                  borderLeft: `3px solid ${darkMode ? '#60a5fa' : '#3b82f6'}`,
                  borderRadius: '0 0.375rem 0.375rem 0'
                }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#4b5563', lineHeight: 1.5 }}>
                    {selectedEditModelDescription}
                  </p>
                </div>
                )}

              
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={labelStyle}>Temperature</label>
                <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>
                  {editContextProfileData.temperature?.toFixed(2)}
                </span>
              </div>
              <input 
                type="range" 
                name="temperature"
                min="0" max="1" step="0.05"
                value={editContextProfileData.temperature || 0}
                onChange={handleEditNumberChange}
                style={{ width: '100%', cursor: 'pointer', marginTop: '0.5rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', marginTop: '0.25rem' }}>
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <hr style={{ borderColor: darkMode ? '#4b5563' : '#e5e7eb', borderTopWidth: 1, borderBottomWidth: 0, margin: '0.5rem 0' }} />

            <div>
              <label style={labelStyle}>Linked Vector Collection (RAG)</label>
              <select 
                name="vectorCollectionId"
                value={editContextProfileData.vectorCollectionId || ''}
                onChange={handleEditTextChange}
                style={inputStyle}
              >
                <option value="">-- No Document Retrieval --</option>
                {vectorCollections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} {collection.vectorDimension ? `(${collection.vectorDimension}D)` : '(Multimodal Pool)'}
                  </option>
                ))}
              </select>
            </div>

            {editContextProfile && (
              <div style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                <div style={{ marginBottom: '0.25rem' }}>Created: {new Date(editContextProfile.createdAt || '').toLocaleDateString()}</div>
                {editContextProfile.updatedAt && <div>Last Modified: {new Date(editContextProfile.updatedAt || '').toLocaleDateString()}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflowX: 'hidden' }}> 
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>System Prompt <span style={{ color: '#ef4444' }}>*</span></h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                  Define the behavior, tone, and strict instructions for the AI model.
                </p>
              </div>
            </div>

            <textarea 
              name="systemPrompt"
              value={editContextProfileData.systemPrompt || ''}
              onChange={handleEditTextChange}
              placeholder="You are a helpful AI assistant..."
              style={{ 
                ...inputStyle, 
                flexGrow: 1, 
                resize: 'none',
                lineHeight: 1.6,
                fontSize: '0.95rem'
              }}
            />
          </div>

        </div>
      </FullScreenModal>

      <BottomRightModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        icon={<i className="bx bx-trash" />}
        title="Delete Context Profile"
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
              onClick={handleDeleteContextProfile}
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
            Deleting Context Profile: <strong>{deleteContextProfile?.name}</strong> from database records. 
          </p>

          {/* --- ACTIVE INTEGRATIONS WARNING --- */}
          {deleteContextProfile?.terminals && deleteContextProfile.terminals.length > 0 && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: darkMode ? '#450a0a' : '#fef2f2', 
              borderRadius: '0.375rem', 
              border: `1px solid ${darkMode ? '#7f1d1d' : '#f87171'}` 
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#fca5a5' : '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                Active Integrations Detected
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: darkMode ? '#fecaca' : '#7f1d1d', lineHeight: 1.4 }}>
                This profile is actively linked to <strong>{deleteContextProfile.terminals.length}</strong> Console Terminal session(s). Deleting it will permanently orphan those chat histories and break their context settings.
              </p>
            </div>
          )}

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

export default ContextProfilesUI;