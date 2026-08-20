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
import { getModelIcon, MODEL_FAMILY_DESCRIPTIONS, ROLE_DESCRIPTIONS } from "../utils/voltaire";
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
  role: 'STANDARD',
  enableCodeInterpreter: false,
  enableWebSearch: false,
  enableMitoMcp: false,
  enableApotheosisMcp: false,
  customMcpUrl: '',
  mcpRequiresAuth: false,
  mcpAuthToken: ''
};

const ContextProfilesUI = ({ darkMode }: { darkMode: boolean }) => {
  const client = generateClient() as any;
  const contextProfilesClient = client.models.ContextProfile;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('name');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewContextProfile, setViewContextProfile] = useState<UIContextProfile | null>(null);
  const [editContextProfile, setEditContextProfile] = useState<UIContextProfile | null>(null);
  const [deleteContextProfile, setDeleteContextProfile] = useState<UIContextProfile | null>(null);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [showEditToken, setShowEditToken] = useState(false);
  
  const [newContextProfileData, setNewContextProfileData] = useState<Partial<UIContextProfile>>(DEFAULT_PROFILE_STATE);
  const [editContextProfileData, setEditContextProfileData] = useState<Partial<UIContextProfile>>({});
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  
  const [createWorkflowSearch, setCreateWorkflowSearch] = useState('');
  const [editWorkflowSearch, setEditWorkflowSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [contextProfiles, setContextProfiles] = useState<UIContextProfile[]>([]);
  const [foundationModels, setFoundationModels] = useState<any[]>([]);
  const [vectorCollections, setVectorCollections] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  
  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode, contextProfiles.length]);

  useEffect(() => {
    const fmSub = client.models.FoundationModel.observeQuery().subscribe({
      next: (data: any) => setFoundationModels(data.items.filter((m: any) => m.isActive)),
      error: (err: any) => console.error("Error fetching models:", err)
    });

    const vcSub = client.models.VectorCollection.observeQuery().subscribe({
      next: (data: any) => setVectorCollections(data.items),
      error: (err: any) => console.error("Error fetching collections:", err)
    });

    const wfSub = client.models.ContextWorkflow.observeQuery().subscribe({
      next: (data: any) => setWorkflows(data.items.filter((w: any) => !w.archived)),
      error: (err: any) => console.error("Error fetching workflows:", err)
    });

    return () => {
      fmSub.unsubscribe();
      vcSub.unsubscribe();
      wfSub.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const contextProfilesSubscription = contextProfilesClient.observeQuery({
      selectionSet: [
        'id', 'name', 'description', 'systemPrompt', 
        'vectorCollectionId', 'llmModelId', 'temperature', 
        'isActive', 'createdAt', 'updatedAt', 
        'role', 'enableCodeInterpreter', 'enableWebSearch', 'supervisorId',
        'enableMitoMcp', 'enableApotheosisMcp', 'customMcpUrl', 
        'provisioningStatus', 'awsAgentId', 'awsAliasId',
        'vectorCollection.*',
        'foundationModel.*',
        'terminals.*',
        'workflows.*',
        'collaborators.*'
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
        role: editContextProfile.role || 'STANDARD',
        enableCodeInterpreter: editContextProfile.enableCodeInterpreter ?? false,
        enableWebSearch: editContextProfile.enableWebSearch ?? false,
        enableMitoMcp: editContextProfile.enableMitoMcp ?? false,
        enableApotheosisMcp: editContextProfile.enableApotheosisMcp ?? false,
        customMcpUrl: editContextProfile.customMcpUrl || '',
        mcpRequiresAuth: editContextProfile.mcpRequiresAuth ?? false,
        mcpAuthToken: editContextProfile.mcpAuthToken || ''
      });
      setSelectedWorkflowIds(Array.isArray(editContextProfile.workflows) ? editContextProfile.workflows.map((w: any) => w.contextWorkflowId) : []);
      setSelectedCollaboratorIds(Array.isArray(editContextProfile.collaborators) ? editContextProfile.collaborators.map((c: any) => c.id) : []);
    }
  }, [editContextProfile]);

  const filterOptions = [
    { label: 'Name', value: 'name' },
    { label: 'Description', value: 'description' },
    { label: 'Role', value: 'role' },
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
        case 'name': return profile.name?.toLowerCase().includes(lowerTerm);
        case 'description': return profile.description?.toLowerCase().includes(lowerTerm);
        case 'role': return profile.role?.toLowerCase().includes(lowerTerm);
        case 'systemPrompt': return profile.systemPrompt?.toLowerCase().includes(lowerTerm);
        case 'foundationModel': {
          const fmName = foundationModels.find(fm => fm.id === profile.llmModelId)?.name || profile.foundationModel?.name || '';
          return fmName.toLowerCase().includes(lowerTerm);
        }
        case 'temperature': return profile.temperature?.toString().includes(lowerTerm);
        case 'createdBy': return profile.createdBy?.toLowerCase().includes(lowerTerm);
        case 'createdAt':
          const dateString = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '';
          return profile.createdAt?.toLowerCase().includes(lowerTerm) || dateString.includes(lowerTerm);
        default: return true;
      }
    });
  }, [contextProfiles, searchTerm, searchBy, foundationModels]);

  const columns: ColumnDef<UIContextProfile>[] = [
    {
      header: 'Name',
      accessor: 'name',
      sortable: true,
      width: '45%', 
      render: (row) => {
        const linkedModel = foundationModels.find(fm => fm.id === row.llmModelId);
        const apiIdentifier = linkedModel?.apiIdentifier || row.foundationModel?.apiIdentifier;
        return (
          <div className="tbl-cell-user" style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '300px' }}>
            <img src={getModelIcon(apiIdentifier)} alt={row.name} style={{ flexShrink: 0 }} />
            <div className="user-info" style={{ minWidth: 0, flexGrow: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                <span 
                  className="primary-text" 
                  style={{ 
                    display: '-webkit-box', 
                    WebkitLineClamp: 2, 
                    WebkitBoxOrient: 'vertical', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word'
                  }}
                >
                  {row.name}
                </span>
                <span style={{ 
                  padding: '0.15rem 0.4rem', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em',
                  backgroundColor: row.role === 'SUPERVISOR' ? '#4c1d95' : (row.role === 'COLLABORATOR' ? '#1e3a8a' : '#064e3b'),
                  color: row.role === 'SUPERVISOR' ? '#ddd6fe' : (row.role === 'COLLABORATOR' ? '#bfdbfe' : '#a7f3d0'),
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  {row.role || 'STANDARD'}
                </span>
                {row.role !== 'STANDARD' && (
                  <span style={{ 
                    fontSize: '0.65rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem',
                    color: row.provisioningStatus === 'READY' ? '#10b981' : (row.provisioningStatus === 'PROVISIONING' ? '#3b82f6' : '#9ca3af'),
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}>
                    {row.provisioningStatus === 'PROVISIONING' && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                    {row.provisioningStatus === 'READY' ? 'AWS Synced' : (row.provisioningStatus === 'PROVISIONING' ? 'Syncing...' : 'Out of Sync')}
                  </span>
                )}
                {!row.isActive && (
                  <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>INACTIVE</span>
                )}
              </div>
              <span 
                className="secondary-text" 
                style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'normal',
                  width: '100%' 
                }}
              >
                {row.description || 'No description provided'}
              </span>
            </div>
          </div>
        )
      }
    },
    {
      header: 'Context Boundary',
      accessor: 'temperature',
      sortable: true,
      width: '25%', 
      render: (row) => (
        <div className="tbl-cell-stacked" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
          <span className="primary-text" style={{ display: 'block' }}>
            {row.temperature || 0}° <a className="secondary-text">ᵀᵉᵐᵖᵉʳᵃᵗᵘʳᵉ</a>
          </span>
          <span className="secondary-text" style={{ display: 'block' }}>
            {row.systemPrompt.replace(/\s/g, "").length > 0 ? `${row.systemPrompt.replace(/\s/g, "").length} letter RAG prompt` : 'No system prompt'}
          </span>
        </div>
      )
    },
    {
      header: 'Embedding',
      accessor: 'vectorCollectionId',
      sortable: false,
      width: '150px', 
      render: (row) => {
        let collectionBadgeClass = 'info';
        if (row.isActive === true) collectionBadgeClass = 'success';
        if (row.isActive === false) collectionBadgeClass = 'danger';
        if (!row.vectorCollection) collectionBadgeClass = 'warning'; 
        const linkedCollection = vectorCollections.find(vc => vc.id === row.vectorCollectionId);
        const collectionName = linkedCollection?.name || row.vectorCollection?.name || 'NO COLLECTION';

        return (
          <div className="tbl-cell-stacked">
            <span 
              className={`tbl-badge ${collectionBadgeClass}`} 
              style={{ 
                width: 'fit-content', 
                maxWidth: '130px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'inline-block'
              }}
              title={collectionName}
            >
              {collectionName}
            </span>
          </div>
        )
      }
    },
    {
      header: 'Actions',
      accessor: 'actions',
      sortable: false,
      width: '200px', 
      render: (row) => (
        <div className="tbl-action-group" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="tbl-action-btn view-btn" onClick={() => { setViewContextProfile(row); setIsViewModalOpen(true); }}>
            View
          </button>
          <button className="tbl-action-btn edit-btn" onClick={() => { setEditContextProfile(row); setEditWorkflowSearch(''); setIsEditModalOpen(true); }}>
            Edit
          </button>
          <button className="tbl-action-btn delete-btn" onClick={() => { setDeleteContextProfile(row); setIsDeleteModalOpen(true); }}>
            Delete
          </button>
        </div>
      )
    }
  ];

  const handleNewTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewContextProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewContextProfileData((prev) => ({ ...prev, [name]: parseFloat(value) }));
  };

  const handleNewToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        role: newContextProfileData.role as any,
        enableCodeInterpreter: newContextProfileData.enableCodeInterpreter,
        enableWebSearch: newContextProfileData.enableWebSearch,
        enableMitoMcp: newContextProfileData.enableMitoMcp,
        enableApotheosisMcp: newContextProfileData.enableApotheosisMcp,
        customMcpUrl: newContextProfileData.role !== 'SUPERVISOR' ? (newContextProfileData.customMcpUrl?.trim() || null) : null,
        mcpRequiresAuth: newContextProfileData.role !== 'SUPERVISOR' ? (newContextProfileData.mcpRequiresAuth || false) : false,
        mcpAuthToken: (newContextProfileData.role !== 'SUPERVISOR' && newContextProfileData.mcpRequiresAuth) ? (newContextProfileData.mcpAuthToken?.trim() || null) : null,
        provisioningStatus: 'UNPROVISIONED', 
        createdBy: getUserEmail ? await getUserEmail() : 'Unknown User',
      });
      
      if (errors) throw new Error(errors[0].message);

      if (selectedWorkflowIds.length > 0) {
        await Promise.all(selectedWorkflowIds.map(wId => 
          client.models.ContextProfileWorkflow.create({ contextProfileId: newProfile.id, contextWorkflowId: wId })
        ));
      }

      if (newContextProfileData.role === 'SUPERVISOR' && selectedCollaboratorIds.length > 0) {
        await Promise.all(selectedCollaboratorIds.map(cId => 
          client.models.ContextProfile.update({ id: cId, supervisorId: newProfile.id })
        ));
      }

      setContextProfiles(prev => {
        const alreadyExists = prev.some(profile => profile.id === newProfile.id);
        if (alreadyExists) return prev;
        
        const formattedNewProfile = {
          ...newProfile,
          workflows: selectedWorkflowIds.map(id => ({ contextWorkflowId: id })),
          collaborators: selectedCollaboratorIds.map(id => ({ id }))
        };

        return [formattedNewProfile, ...prev];
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
        role: editContextProfileData.role as any,
        enableCodeInterpreter: editContextProfileData.enableCodeInterpreter,
        enableWebSearch: editContextProfileData.enableWebSearch,
        enableMitoMcp: editContextProfileData.enableMitoMcp,
        enableApotheosisMcp: editContextProfileData.enableApotheosisMcp,
        customMcpUrl: editContextProfileData.role !== 'SUPERVISOR' ? (editContextProfileData.customMcpUrl?.trim() || null) : null,
        mcpRequiresAuth: editContextProfileData.role !== 'SUPERVISOR' ? (editContextProfileData.mcpRequiresAuth || false) : false,
        mcpAuthToken: (editContextProfileData.role !== 'SUPERVISOR' && editContextProfileData.mcpRequiresAuth) ? (editContextProfileData.mcpAuthToken?.trim() || null) : null,
        provisioningStatus: editContextProfileData.role !== 'STANDARD' ? 'UNPROVISIONED' : null,
        updatedBy: getUserEmail ? await getUserEmail() : 'Unknown User',
      });
      if (errors) throw new Error(errors[0].message);

      const existingLinksResp = await client.models.ContextProfileWorkflow.list({
        filter: { contextProfileId: { eq: editContextProfile.id } }
      });
      const existingLinks = existingLinksResp.data;
      const existingWIds = existingLinks.map((l: any) => l.contextWorkflowId);
      
      const toAddWorkflows = selectedWorkflowIds.filter(id => !existingWIds.includes(id));
      const toRemoveWorkflows = existingLinks.filter((l: any) => !selectedWorkflowIds.includes(l.contextWorkflowId));
      
      await Promise.all([
        ...toAddWorkflows.map(wId => client.models.ContextProfileWorkflow.create({ contextProfileId: editContextProfile.id, contextWorkflowId: wId })),
        ...toRemoveWorkflows.map((link: any) => client.models.ContextProfileWorkflow.delete({ id: link.id }))
      ]);

      const existingCIds = contextProfiles.filter(p => p.supervisorId === editContextProfile.id).map(p => p.id!);
      const targetCIds = editContextProfileData.role === 'SUPERVISOR' ? selectedCollaboratorIds : [];
      
      const toAddCollabs = targetCIds.filter(id => !existingCIds.includes(id));
      const toRemoveCollabs = existingCIds.filter(id => !targetCIds.includes(id));
      
      await Promise.all([
        ...toAddCollabs.map(cId => client.models.ContextProfile.update({ id: cId, supervisorId: editContextProfile.id })),
        ...toRemoveCollabs.map(cId => client.models.ContextProfile.update({ id: cId, supervisorId: null }))
      ]);

      setContextProfiles(prev => prev.map(item => 
        item.id === updatedProfile.id ? {
          ...updatedProfile, 
          workflows: selectedWorkflowIds.map(id => ({ contextWorkflowId: id })), 
          collaborators: targetCIds.map(id => ({ id }))
        } : item
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
      <div style={{ padding: '2rem', boxSizing: 'border-box', maxWidth: '100%' }}>
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
      <FAButton darkMode={darkMode} onClick={() => {
        setNewContextProfileData(DEFAULT_PROFILE_STATE);
        setSelectedWorkflowIds([]);
        setSelectedCollaboratorIds([]);
        setCreateWorkflowSearch('');
        setIsCreateModalOpen(true);
      }} icon={
        <svg  xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox={"0 0 24 24"}>
          <path d="M21.57 2.18a.98.98 0 0 0-.92-.11C7.29 7.2 4.15 20.71 4.02 21.28l1.95.43s.36-1.55 
          1.31-3.72H11c6.07 0 11-4.93 11-11V3c0-.33-.16-.64-.43-.82M20 7c0 4.96-4.04 9-9 9H8.24C10.26 
          12.16 13.87 7.31 20 4.5zM5 10h2V7h3V5H7V2H5v3H2v2h3z"></path>
        </svg>} />

      {/* VIEW MODAL */}
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
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Architecture Role</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 600 }}>
                  {viewContextProfile?.role || 'STANDARD'}
                </span>
              </div>

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
              fontFamily: 'monospace',
              maxHeight: '200px'
            }}>
              {viewContextProfile?.systemPrompt || 'No prompt defined.'}
            </div>
            
            <hr style={{ borderColor: darkMode ? '#374151' : '#e5e7eb', margin: '1rem 0' }} />
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '0.9rem' }}>Native Capabilities</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.875rem' }}>
                  <li>Code Interpreter: {viewContextProfile?.enableCodeInterpreter ? <span style={{color: '#10b981'}}>Enabled</span> : 'Disabled'}</li>
                  <li>Web Search: {viewContextProfile?.enableWebSearch ? <span style={{color: '#10b981'}}>Enabled</span> : 'Disabled'}</li>
                </ul>
                <h4 style={{ margin: '1rem 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '0.9rem' }}>MCP Servers</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.875rem' }}>
                  <li>Mito MCP: {viewContextProfile?.enableMitoMcp ? <span style={{color: '#10b981'}}>Enabled</span> : 'Disabled'}</li>
                  <li>Apotheosis MCP: {viewContextProfile?.enableApotheosisMcp ? <span style={{color: '#10b981'}}>Enabled</span> : 'Disabled'}</li>
                  {viewContextProfile?.customMcpUrl && viewContextProfile.role !== 'SUPERVISOR' && <li>Custom: {viewContextProfile.customMcpUrl}</li>}
                </ul>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '0.9rem' }}>Assigned Workflows</h4>
                {Array.isArray(viewContextProfile?.workflows) && viewContextProfile.workflows.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.875rem' }}>
                    {viewContextProfile.workflows.map((w: any, i: number) => {
                       const wf = workflows.find(wf => wf.id === w.contextWorkflowId);
                       return <li key={i}>{wf ? wf.name : w.contextWorkflowId}</li>;
                    })}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>None assigned.</span>
                )}
              </div>
            </div>

          </div>

        </div>
      </ExtraLargeModal>

      <FullScreenModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Context Profile"
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2.5rem', height: '100%' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '1rem', borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, overflowY: 'auto', minWidth: 0, overflowX: 'hidden' }}>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>Agentic Role</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {['STANDARD', 'SUPERVISOR', 'COLLABORATOR'].map(role => (
                  <label key={role} style={{ 
                    flex: 1, padding: '0.75rem 0.5rem', border: `2px solid ${newContextProfileData.role === role ? '#3b82f6' : (darkMode ? '#374151' : '#e5e7eb')}`, 
                    borderRadius: '0.5rem', backgroundColor: newContextProfileData.role === role ? (darkMode ? '#1e3a8a' : '#eff6ff') : 'transparent',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                  }}>
                    <input type="radio" name="role" value={role} checked={newContextProfileData.role === role} onChange={handleNewTextChange} style={{ display: 'none' }} />
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: newContextProfileData.role === role ? (darkMode ? '#bfdbfe' : '#1d4ed8') : (darkMode ? '#d1d5db' : '#4b5563') }}>
                      {role}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ 
                  marginTop: '0.75rem', 
                  padding: '0.5rem 0.75rem', 
                  backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', 
                  borderLeft: `3px solid ${darkMode ? '#60a5fa' : '#3b82f6'}`, 
                  borderRadius: '0 0.375rem 0.375rem 0',
                  transition: 'background-color 0.3s ease, border-color 0.3s ease'
                }}>
              <p key={newContextProfileData.role} style={{ 
                margin: 0, 
                fontSize: '0.75rem', 
                color: darkMode ? '#9ca3af' : '#4b5563', 
                lineHeight: 1.4,
                animation: 'fadeIn 0.3s ease-in-out'
              }}>
                {ROLE_DESCRIPTIONS[newContextProfileData.role || 'STANDARD']}
              </p>
            </div>
            </div>

            <div>
              <label style={labelStyle}>Profile Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" name="name" value={newContextProfileData.name} onChange={handleNewTextChange} placeholder="e.g., Customer Support Agent"
                style={{ ...inputStyle, borderColor: isNameDuplicate ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db') }}
              />
              {isNameDuplicate && <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>A profile with this name already exists.</p>}
            </div>

            <div>
              <label style={labelStyle}>LLM Engine <span style={{ color: '#ef4444' }}>*</span></label>
              <select name="llmModelId" value={newContextProfileData.llmModelId || ''} onChange={handleNewTextChange} style={inputStyle}>
                <option value="" disabled>Select a Foundation Model...</option>
                {foundationModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
              {selectedCreateModelDescription && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', borderLeft: `3px solid ${darkMode ? '#60a5fa' : '#3b82f6'}`, borderRadius: '0 0.375rem 0.375rem 0' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#4b5563', lineHeight: 1.5 }}>
                    {selectedCreateModelDescription}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
              <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" name="isActive" checked={newContextProfileData.isActive || false} onChange={handleNewToggleChange} style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem', cursor: 'pointer' }} />
                  <span style={{ fontWeight: 500, fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Profile is Active</span>
                </label>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{...labelStyle, marginBottom: 0}}>Temperature</label>
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>{newContextProfileData.temperature?.toFixed(2)}</span>
                </div>
                <input type="range" name="temperature" min="0" max="1" step="0.05" value={newContextProfileData.temperature || 0} onChange={handleNewNumberChange} style={{ width: '100%', cursor: 'pointer', marginTop: '0.5rem' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea 
                name="description" value={newContextProfileData.description || ''} onChange={handleNewTextChange} placeholder="Internal notes about what this profile is used for..."
                rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', minWidth: 0, overflowX: 'hidden', paddingRight: '0.5rem', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>System Prompt <span style={{ color: '#ef4444' }}>*</span></h3>
              </div>
              <textarea 
                name="systemPrompt" value={newContextProfileData.systemPrompt} onChange={handleNewTextChange} placeholder="You are a helpful AI assistant..."
                style={{ ...inputStyle, minHeight: '150px', resize: 'vertical', lineHeight: 1.6, fontSize: '0.95rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {newContextProfileData.role === 'SUPERVISOR' && (
                  <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Routing & Delegation</h4>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.4 }}>Select Collaborator agents this Supervisor can invoke.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                      {contextProfiles.filter(p => p.role === 'COLLABORATOR').length === 0 ? (
                        <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: darkMode ? '#6b7280' : '#9ca3af' }}>No Collaborator Context Profiles found.</span>
                      ) : (
                        contextProfiles.filter(p => p.role === 'COLLABORATOR').map(collab => (
                          <label key={collab.id!} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', backgroundColor: darkMode ? '#111827' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCollaboratorIds.includes(collab.id!)} onChange={(e) => e.target.checked ? setSelectedCollaboratorIds([...selectedCollaboratorIds, collab.id!]) : setSelectedCollaboratorIds(selectedCollaboratorIds.filter(id => id !== collab.id!))} style={{ marginRight: '0.75rem' }} />
                            <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>{collab.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capabilities & Tools</h4>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Linked Vector Collection (RAG)</label>
                    <select name="vectorCollectionId" value={newContextProfileData.vectorCollectionId || ''} onChange={handleNewTextChange} style={inputStyle}>
                      <option value="">-- No Document Retrieval --</option>
                      {vectorCollections.map((collection) => (
                        <option key={collection.id} value={collection.id}>{collection.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableCodeInterpreter" checked={newContextProfileData.enableCodeInterpreter!} onChange={handleNewToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Enable Code Interpreter Sandbox</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableWebSearch" checked={newContextProfileData.enableWebSearch!} onChange={handleNewToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Enable Web Search</span>
                  </div>
                </div>

                <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model Context Protocol (MCP)</h4>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableMitoMcp" checked={newContextProfileData.enableMitoMcp!} onChange={handleNewToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Enable Mito MCP</span>
                  </div>
                  <div style={{ marginBottom: newContextProfileData.role !== 'SUPERVISOR' ? '1rem' : '0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableApotheosisMcp" checked={newContextProfileData.enableApotheosisMcp!} onChange={handleNewToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Enable Apotheosis MCP</span>
                  </div>
                  {newContextProfileData.role !== 'SUPERVISOR' && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={labelStyle}>Custom MCP Server URL (Optional)</label>
                    <input type="url" name="customMcpUrl" value={newContextProfileData.customMcpUrl || ''} onChange={handleNewTextChange} placeholder="https://..." 
                      style={inputStyle} autoComplete="off" data-1p-ignore />
                    
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input type="checkbox" name="mcpRequiresAuth" checked={newContextProfileData.mcpRequiresAuth || false} onChange={handleNewToggleChange} style={{ cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Authentication Required</span>
                    </div>

                    <div style={{
                      maxHeight: newContextProfileData.mcpRequiresAuth ? '100px' : '0',
                      opacity: newContextProfileData.mcpRequiresAuth ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease-in-out',
                      marginTop: newContextProfileData.mcpRequiresAuth ? '0.75rem' : '0'
                    }}>
                      <label style={labelStyle}>Authentication Token</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type={showCreateToken ? "text" : "password"} 
                          name="mcpAuthToken" 
                          value={newContextProfileData.mcpAuthToken || ''} 
                          onChange={handleNewTextChange} 
                          placeholder="Bearer token or API key..." 
                          style={{ ...inputStyle, paddingRight: '2.5rem' }} 
                          autoComplete="new-password"
                          data-1p-ignore
                        />
                        <i 
                          className={`bx ${showCreateToken ? 'bx-hide' : 'bx-show'}`} 
                          onClick={() => setShowCreateToken(!showCreateToken)} 
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '1.1rem' }}
                        ></i>
                      </div>
                    </div>
                  </div>
                )}
                </div>

              </div>

              <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Automation Workflows</h4>
                
                {selectedWorkflowIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {selectedWorkflowIds.map(id => {
                      const wf = workflows.find(w => w.id === id);
                      if (!wf) return null;
                      return (
                        <span key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: darkMode ? '#f9fafb' : '#111827' }}>
                          {wf.name}
                          <i className="bx bx-x" onClick={() => setSelectedWorkflowIds(selectedWorkflowIds.filter(wId => wId !== id))} style={{ cursor: 'pointer', marginLeft: '0.25rem' }}></i>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={createWorkflowSearch}
                  onChange={(e) => setCreateWorkflowSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '0.5rem', fontSize: '0.875rem', padding: '0.5rem' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '200px', overflowY: 'auto', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem', backgroundColor: darkMode ? '#111827' : '#ffffff' }}>
                  {workflows.filter(w => w.name.toLowerCase().includes(createWorkflowSearch.toLowerCase())).map(workflow => (
                    <label key={workflow.id!} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedWorkflowIds.includes(workflow.id!)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedWorkflowIds([...selectedWorkflowIds, workflow.id!]);
                          else setSelectedWorkflowIds(selectedWorkflowIds.filter(id => id !== workflow.id!));
                        }}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>{workflow.name}</span>
                    </label>
                  ))}
                  {workflows.filter(w => w.name.toLowerCase().includes(createWorkflowSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', textAlign: 'center' }}>No workflows found.</div>
                  )}
                </div>

              </div>
            </div>

          </div>

        </div>
      </FullScreenModal>

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
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2.5rem', height: '100%' }}>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.5rem', 
            paddingRight: '1rem',
            borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            overflowY: 'auto',
            minWidth: 0,         
            overflowX: 'hidden'  
          }}>
            
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>Agentic Role</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {['STANDARD', 'SUPERVISOR', 'COLLABORATOR'].map(role => (
                  <label key={role} style={{ 
                    flex: 1, padding: '0.75rem 0.5rem', border: `2px solid ${editContextProfileData.role === role ? '#3b82f6' : (darkMode ? '#374151' : '#e5e7eb')}`, 
                    borderRadius: '0.5rem', backgroundColor: editContextProfileData.role === role ? (darkMode ? '#1e3a8a' : '#eff6ff') : 'transparent',
                    cursor: 'pointer', textAlign: 'center'
                  }}>
                    <input type="radio" name="role" value={role} checked={editContextProfileData.role === role} onChange={handleEditTextChange} style={{ display: 'none' }} />
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: editContextProfileData.role === role ? (darkMode ? '#bfdbfe' : '#1d4ed8') : (darkMode ? '#d1d5db' : '#4b5563') }}>
                      {role}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ 
                marginTop: '0.75rem', 
                padding: '0.5rem 0.75rem', 
                backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', 
                borderLeft: `3px solid ${darkMode ? '#60a5fa' : '#3b82f6'}`, 
                borderRadius: '0 0.375rem 0.375rem 0',
                transition: 'background-color 0.3s ease, border-color 0.3s ease'
              }}>
                <p key={editContextProfileData.role} style={{ 
                  margin: 0, 
                  fontSize: '0.75rem', 
                  color: darkMode ? '#9ca3af' : '#4b5563', 
                  lineHeight: 1.4,
                  animation: 'fadeIn 0.3s ease-in-out'
                }}>
                  {ROLE_DESCRIPTIONS[editContextProfileData.role || 'STANDARD']}
              </p>
            </div>
            </div>

            <div>
              <label style={labelStyle}>Profile Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" name="name" value={editContextProfileData.name || ''} onChange={handleEditTextChange} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>LLM Engine <span style={{ color: '#ef4444' }}>*</span></label>
              <select name="llmModelId" value={editContextProfileData.llmModelId || ''} onChange={handleEditTextChange} style={inputStyle}>
                <option value="">Select a Foundation Model...</option>
                {foundationModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
              {selectedEditModelDescription && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', borderLeft: `3px solid ${darkMode ? '#60a5fa' : '#3b82f6'}`, borderRadius: '0 0.375rem 0.375rem 0' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#4b5563', lineHeight: 1.5 }}>
                    {selectedEditModelDescription}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
              <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '0.75rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" name="isActive" checked={editContextProfileData.isActive || false} onChange={handleEditToggleChange} style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} />
                  <span style={{ fontWeight: 500, fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Profile is Active</span>
                </label>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{...labelStyle, marginBottom: 0}}>Temperature</label>
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>{editContextProfileData.temperature?.toFixed(2)}</span>
                </div>
                <input type="range" name="temperature" min="0" max="1" step="0.05" value={editContextProfileData.temperature || 0} onChange={handleEditNumberChange} style={{ width: '100%', cursor: 'pointer', marginTop: '0.5rem' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea name="description" value={editContextProfileData.description || ''} onChange={handleEditTextChange} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {editContextProfile && (
              <div style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                <div style={{ marginBottom: '0.25rem' }}>Created: {new Date(editContextProfile.createdAt || '').toLocaleDateString()}</div>
                {editContextProfile.updatedAt && <div>Last Modified: {new Date(editContextProfile.updatedAt || '').toLocaleDateString()}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', minWidth: 0, overflowX: 'hidden', paddingRight: '0.5rem', overflowY: 'auto' }}> 
            
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>System Prompt <span style={{ color: '#ef4444' }}>*</span></h3>
              </div>
              <textarea 
                name="systemPrompt" value={editContextProfileData.systemPrompt || ''} onChange={handleEditTextChange} placeholder="You are a helpful AI assistant..."
                style={{ ...inputStyle, minHeight: '150px', resize: 'vertical', lineHeight: 1.6, fontSize: '0.95rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {editContextProfileData.role === 'SUPERVISOR' && (
                  <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase' }}>Routing & Delegation</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                      {contextProfiles.filter(p => p.role === 'COLLABORATOR' && p.id !== editContextProfile?.id).length === 0 ? (
                        <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: darkMode ? '#6b7280' : '#9ca3af' }}>No Collaborator Context Profiles found.</span>
                      ) : (
                        contextProfiles.filter(p => p.role === 'COLLABORATOR' && p.id !== editContextProfile?.id).map(collab => (
                          <label key={collab.id!} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', backgroundColor: darkMode ? '#111827' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selectedCollaboratorIds.includes(collab.id!)} onChange={(e) => e.target.checked ? setSelectedCollaboratorIds([...selectedCollaboratorIds, collab.id!]) : setSelectedCollaboratorIds(selectedCollaboratorIds.filter(id => id !== collab.id!))} style={{ marginRight: '0.75rem' }} />
                            <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>{collab.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase' }}>Native Capabilities</h4>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>Vector Collection (RAG)</label>
                    <select name="vectorCollectionId" value={editContextProfileData.vectorCollectionId || ''} onChange={handleEditTextChange} style={inputStyle}>
                      <option value="">-- No Document Retrieval --</option>
                      {vectorCollections.map((collection) => (
                        <option key={collection.id} value={collection.id}>{collection.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableCodeInterpreter" checked={editContextProfileData.enableCodeInterpreter!} onChange={handleEditToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Code Interpreter</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableWebSearch" checked={editContextProfileData.enableWebSearch!} onChange={handleEditToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Web Search</span>
                  </div>
                </div>

                <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model Context Protocol (MCP)</h4>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableMitoMcp" checked={editContextProfileData.enableMitoMcp!} onChange={handleEditToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Enable Mito MCP</span>
                  </div>
                  <div style={{ marginBottom: editContextProfileData.role !== 'SUPERVISOR' ? '1rem' : '0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" name="enableApotheosisMcp" checked={editContextProfileData.enableApotheosisMcp!} onChange={handleEditToggleChange} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Enable Apotheosis MCP</span>
                  </div>
                  {editContextProfileData.role !== 'SUPERVISOR' && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={labelStyle}>Custom MCP Server URL (Optional)</label>
                    <input type="url" name="customMcpUrl" value={editContextProfileData.customMcpUrl || ''} onChange={handleEditTextChange} placeholder="https://..." style={inputStyle} />
                    
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input type="checkbox" name="mcpRequiresAuth" checked={editContextProfileData.mcpRequiresAuth || false} onChange={handleEditToggleChange} style={{ cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Authentication Required</span>
                    </div>

                    <div style={{
                      maxHeight: editContextProfileData.mcpRequiresAuth ? '100px' : '0',
                      opacity: editContextProfileData.mcpRequiresAuth ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease-in-out',
                      marginTop: editContextProfileData.mcpRequiresAuth ? '0.75rem' : '0'
                    }}>
                      <label style={labelStyle}>Authentication Token</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type={showEditToken ? "text" : "password"} 
                          name="mcpAuthToken" 
                          value={editContextProfileData.mcpAuthToken || ''} 
                          onChange={handleEditTextChange} 
                          placeholder="Bearer token or API key..." 
                          style={{ ...inputStyle, paddingRight: '2.5rem' }} 
                        />
                        <i 
                          className={`bx ${showEditToken ? 'bx-hide' : 'bx-show'}`} 
                          onClick={() => setShowEditToken(!showEditToken)} 
                          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '1.1rem' }}
                        ></i>
                      </div>
                    </div>
                  </div>
                )}
                </div>

              </div>

              <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: darkMode ? '#d1d5db' : '#4b5563', textTransform: 'uppercase' }}>Automation Action Groups</h4>
                
                {selectedWorkflowIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {selectedWorkflowIds.map(id => {
                      const wf = workflows.find(w => w.id === id);
                      if (!wf) return null;
                      return (
                        <span key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: darkMode ? '#374151' : '#e5e7eb', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: darkMode ? '#f9fafb' : '#111827' }}>
                          {wf.name}
                          <i className="bx bx-x" onClick={() => setSelectedWorkflowIds(selectedWorkflowIds.filter(wId => wId !== id))} style={{ cursor: 'pointer', marginLeft: '0.25rem' }}></i>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={editWorkflowSearch}
                  onChange={(e) => setEditWorkflowSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '0.5rem', fontSize: '0.875rem', padding: '0.5rem' }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '200px', overflowY: 'auto', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.375rem', backgroundColor: darkMode ? '#111827' : '#ffffff' }}>
                  {workflows.filter(w => w.name.toLowerCase().includes(editWorkflowSearch.toLowerCase())).map(workflow => (
                    <label key={workflow.id!} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedWorkflowIds.includes(workflow.id!)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedWorkflowIds([...selectedWorkflowIds, workflow.id!]);
                          else setSelectedWorkflowIds(selectedWorkflowIds.filter(id => id !== workflow.id!));
                        }}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>{workflow.name}</span>
                    </label>
                  ))}
                  {workflows.filter(w => w.name.toLowerCase().includes(editWorkflowSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', textAlign: 'center' }}>No workflows found.</div>
                  )}
                </div>

              </div>

            </div>
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