import React, { useEffect, useMemo, useState } from "react";
import TitleRibbon from "../components/titleribbon";
import SearchRibbon from "../components/searchribbon";
import FAButton from "../components/floatingactionbutton";
import { AddAutomationWorkflowSVG, getModelIcon } from "../utils/voltaire";
import DataTable, { type ColumnDef } from "../components/datatable";
import ExtraLargeModal from "../components/extralargemodal";
import FullScreenModal from "../components/fullscreenmodal";
import BottomRightModal from "../components/bottomrightmodal";
import type { UIAutomationWorkflow } from "../data/automationworkflows";
import { generateClient } from "aws-amplify/api";

const isValidURL = (urlString?: string | null): boolean => {
  if (!urlString) return false;
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
};

const DATA_TYPES = ['String', 'Number', 'Float', 'Boolean', 'Array', 'Tuple', 'Date', 'DateTime', 'Object'];

const AutomationWorkflowsUI = ({ darkMode }: { darkMode: boolean }) => {
  const client = generateClient() as any;
  const contextWorkflowsClient = client.models.ContextWorkflow;

  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('name');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [showEditToken, setShowEditToken] = useState(false);
  const [automationWorkflows, setAutomationWorkflows] = useState<UIAutomationWorkflow[]>([]);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [viewWorkflow, setViewWorkflow] = useState<UIAutomationWorkflow | null>(null);
  const [deleteWorkflow, setDeleteWorkflow] = useState<UIAutomationWorkflow | null>(null);
  const [editWorkflow, setEditWorkflow] = useState<UIAutomationWorkflow | null>(null);
  
  const initialWorkflowState: Partial<UIAutomationWorkflow> = {
    name: '',
    description: '',
    tool: '' as any,
    triggerURL: '',
    callbackURL: '',
    vectorFactor: 0,
    archived: false,
    inputParameters: [],
    outputVariables: [],
    requiresAuth: false,
    authHeader: ''
  };
  
  const [newWorkflowData, setNewWorkflowData] = useState<Partial<UIAutomationWorkflow>>(initialWorkflowState);
  const [editWorkflowData, setEditWorkflowData] = useState<Partial<UIAutomationWorkflow>>({});

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#f9fafb' : '#111827',
    marginTop: '0.5rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const
  };

  const labelStyle = {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: darkMode ? '#d1d5db' : '#374151',
    display: 'block'
  };

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  useEffect(() => {
    const subscription = contextWorkflowsClient.observeQuery({
      selectionSet: [
        'id', 'name', 'description', 'tool', 'triggerURL', 'callbackURL',
        'inputParameters.*', 'outputVariables.*', 'pingSuccess', 'archived', 
        'vectorFactor', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'profiles.*',
        'requiresAuth', 'authHeader'
      ]
    }).subscribe({
      next: (data: any) => {
        setAutomationWorkflows(data.items as UIAutomationWorkflow[]);
        setIsLoading(false);
      },
      error: (err: any) => {
        console.error("Error fetching workflows:", err);
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [contextWorkflowsClient]);

  const filteredWorkflows = useMemo(() => {
    if (!searchTerm.trim()) return automationWorkflows;
    const lowerTerm = searchTerm.toLowerCase();

    return automationWorkflows.filter(workflow => {
      switch (searchBy) {
        case 'name': return workflow.name?.toLowerCase().includes(lowerTerm);
        case 'description': return workflow.description?.toLowerCase().includes(lowerTerm);
        case 'tool': return workflow.tool?.toLowerCase().includes(lowerTerm);
        case 'triggerUrl': return workflow.triggerURL?.toLowerCase().includes(lowerTerm);
        case 'callbackUrl': return workflow.callbackURL?.toLowerCase().includes(lowerTerm);
        case 'vectorFactor': return workflow.vectorFactor?.toString().includes(lowerTerm);
        case 'createdBy': return workflow.createdBy?.toLowerCase().includes(lowerTerm);
        case 'createdAt':
          const dateString = workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString() : '';
          return workflow.createdAt?.toLowerCase().includes(lowerTerm) || dateString.includes(lowerTerm);
        default: return true;
      }
    });
  }, [automationWorkflows, searchTerm, searchBy]);

  const isNameDuplicate = automationWorkflows.some(w => w.name.toLowerCase() === newWorkflowData.name?.toLowerCase());
  const isValidTrigger = isValidURL(newWorkflowData.triggerURL);
  const isValidCallback = !newWorkflowData.callbackURL || isValidURL(newWorkflowData.callbackURL);
  
  const isWorkflowValid = !!(
    newWorkflowData.name && 
    newWorkflowData.tool && 
    isValidTrigger && 
    isValidCallback && 
    !isNameDuplicate
  );

  const handleCreateTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setNewWorkflowData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleCreateNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWorkflowData(prev => ({ ...prev, [e.target.name]: parseFloat(e.target.value) || 0 }));
  };

  const handleCreateToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWorkflowData(prev => ({ ...prev, [e.target.name]: e.target.checked }));
  };

  const handleCreateAddParameter = (type: 'input' | 'output') => {
    const key = type === 'input' ? 'inputParameters' : 'outputVariables';
    const currentList = newWorkflowData[key] || [];
    setNewWorkflowData(prev => ({ ...prev, [key]: [...currentList, { variable: '', type: 'String', isRequired: false }] }));
  };

  const handleCreateUpdateParameter = (type: 'input' | 'output', index: number, field: 'variable' | 'isRequired' | 'type', value: string | boolean) => {
    const key = type === 'input' ? 'inputParameters' : 'outputVariables';
    const currentList = newWorkflowData[key] || [];
    const updatedList = currentList.map((param, i) => i === index ? { ...param, [field]: value } : param);
    setNewWorkflowData(prev => ({ ...prev, [key]: updatedList }));
  };

  const handleCreateRemoveParameter = (type: 'input' | 'output', index: number) => {
    const key = type === 'input' ? 'inputParameters' : 'outputVariables';
    const currentList = newWorkflowData[key] || [];
    setNewWorkflowData(prev => ({ ...prev, [key]: currentList.filter((_, i) => i !== index) }));
  };

  const handleCreateSubmit = async () => {
    if (!isWorkflowValid) return;
    
    const cleanInputs = newWorkflowData.inputParameters?.filter(p => p.variable.trim() !== '') || [];
    const cleanOutputs = newWorkflowData.outputVariables?.filter(p => p.variable.trim() !== '') || [];

    try {
      await contextWorkflowsClient.create({
        name: newWorkflowData.name,
        description: newWorkflowData.description,
        tool: newWorkflowData.tool,
        triggerURL: newWorkflowData.triggerURL,
        callbackURL: newWorkflowData.callbackURL,
        vectorFactor: newWorkflowData.vectorFactor,
        archived: newWorkflowData.archived,
        inputParameters: cleanInputs,
        outputVariables: cleanOutputs,
        requiresAuth: newWorkflowData.requiresAuth || false,
        authHeader: newWorkflowData.requiresAuth ? (newWorkflowData.authHeader?.trim() || null) : null
      });
      setIsCreateModalOpen(false);
      setNewWorkflowData(initialWorkflowState);
    } catch (err) {
      console.error("Error creating workflow:", err);
    }
  };

  const isEditNameDuplicate = automationWorkflows.some(w => w.id !== editWorkflowData.id && w.name.toLowerCase() === editWorkflowData.name?.toLowerCase());
  const isEditValidTrigger = isValidURL(editWorkflowData.triggerURL);
  const isEditValidCallback = !editWorkflowData.callbackURL || isValidURL(editWorkflowData.callbackURL);

  const isEditValid = !!(
    editWorkflowData.name && 
    editWorkflowData.tool && 
    isEditValidTrigger && 
    isEditValidCallback && 
    !isEditNameDuplicate
  );

  const handleEditTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setEditWorkflowData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleEditNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditWorkflowData(prev => ({ ...prev, [e.target.name]: parseFloat(e.target.value) || 0 }));
  };

  const handleEditToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditWorkflowData(prev => ({ ...prev, [e.target.name]: e.target.checked }));
  };

  const handleEditAddParameter = (type: 'input' | 'output') => {
    const key = type === 'input' ? 'inputParameters' : 'outputVariables';
    const currentList = editWorkflowData[key] || [];
    setEditWorkflowData(prev => ({ ...prev, [key]: [...currentList, { variable: '', type: 'String', isRequired: false }] }));
  };

  const handleEditUpdateParameter = (type: 'input' | 'output', index: number, field: 'variable' | 'isRequired' | 'type', value: string | boolean) => {
    const key = type === 'input' ? 'inputParameters' : 'outputVariables';
    const currentList = editWorkflowData[key] || [];
    const updatedList = currentList.map((param, i) => i === index ? { ...param, [field]: value } : param);
    setEditWorkflowData(prev => ({ ...prev, [key]: updatedList }));
  };

  const handleEditRemoveParameter = (type: 'input' | 'output', index: number) => {
    const key = type === 'input' ? 'inputParameters' : 'outputVariables';
    const currentList = editWorkflowData[key] || [];
    setEditWorkflowData(prev => ({ ...prev, [key]: currentList.filter((_, i) => i !== index) }));
  };

  const handleEditSubmit = async () => {
    if (!isEditValid || !editWorkflowData.id) return;
    
    const cleanInputs = editWorkflowData.inputParameters?.filter(p => p.variable.trim() !== '') || [];
    const cleanOutputs = editWorkflowData.outputVariables?.filter(p => p.variable.trim() !== '') || [];

    try {
      await contextWorkflowsClient.update({
        id: editWorkflowData.id,
        name: editWorkflowData.name,
        description: editWorkflowData.description,
        tool: editWorkflowData.tool,
        triggerURL: editWorkflowData.triggerURL,
        callbackURL: editWorkflowData.callbackURL,
        vectorFactor: editWorkflowData.vectorFactor,
        archived: editWorkflowData.archived,
        inputParameters: cleanInputs,
        outputVariables: cleanOutputs,
        requiresAuth: editWorkflowData.requiresAuth || false,
        authHeader: editWorkflowData.requiresAuth ? (editWorkflowData.authHeader?.trim() || null) : null
      });
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Error updating workflow:", err);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!deleteWorkflow?.id) return;
    try {
      await contextWorkflowsClient.delete({ id: deleteWorkflow.id });
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error("Error deleting workflow:", err);
    }
  };

  const columns: ColumnDef<UIAutomationWorkflow>[] = [
    {
      header: 'Name',
      accessor: 'name',
      sortable: true,
      width: '45%', 
      render: (row) => (
        <div className="tbl-cell-user" style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '300px' }}>
          <img src={getModelIcon(row.tool)} alt={row.tool} style={{ flexShrink: 0 }} />
          <div className="user-info" style={{ minWidth: 0, flexGrow: 1 }}>
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
              {row.description || 'No description'}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'I/O Parameters',
      accessor: 'inputParameters' as any,
      sortable: false,
      width: '25%', 
      render: (row) => {
        const validInputs = row.inputParameters?.filter(p => p.variable && p.variable.trim() !== '') || [];
        const validOutputs = row.outputVariables?.filter(p => p.variable && p.variable.trim() !== '') || [];

        return (
          <div className="tbl-cell-stacked" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
            <span className="primary-text" style={{ display: 'block' }}>
              {validInputs.length ? `${validInputs.length} Input${validInputs.length > 1 ? 's' : ''}` : 'No inputs'}
            </span>
            <span className="secondary-text" style={{ display: 'block' }}>
              {validOutputs.length ? `${validOutputs.length} Output${validOutputs.length > 1 ? 's' : ''}` : 'No outputs'}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Vector Factor',
      accessor: 'vectorFactor',
      sortable: true,
      width: '120px', 
      render: (row) => (
        <div className="tbl-cell-stacked">
          <span style={{fontSize: '1.3rem', fontWeight: 800}} className="primary-text">{row.vectorFactor ?? 0}°</span>
          <span style={{width: 'fit-content'}} className={`tbl-badge ${row.archived ? 'danger' : 'success'}`}>
            {row.archived ? 'Archived' : 'Active'}
          </span>
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      sortable: false,
      width: '200px', 
      render: (row) => (
        <div className="tbl-action-group" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            className="tbl-action-btn view-btn" 
            onClick={() => { setViewWorkflow(row); setIsViewModalOpen(true); }}
          >
            View
          </button>
          <button 
            className="tbl-action-btn edit-btn" 
            onClick={() => { setEditWorkflow(row); setEditWorkflowData(row); setIsEditModalOpen(true); }}
          >
            Edit
          </button>
          <button 
            className="tbl-action-btn delete-btn" 
            onClick={() => { setDeleteWorkflow(row); setIsDeleteModalOpen(true); }}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  const filterOptions = [
    { label: 'Name', value: 'name' },
    { label: 'Description', value: 'description' },
    { label: 'Automation Tool', value: 'tool' },
    { label: 'Trigger URL', value: 'triggerUrl' },
    { label: 'Callback URL', value: 'callbackUrl' },
    { label: 'Vector Factor', value: 'vectorFactor' },
    { label: 'Created By', value: 'createdBy' },
    { label: 'Date', value: 'createdAt' },
  ];

  return (
    <>
      <TitleRibbon title="Automation Workflows" darkMode={darkMode} typewriterFX textAlignment="right"/>
      <SearchRibbon 
        darkMode={darkMode}
        recordCount={filteredWorkflows.length}
        recordLabel="Automation Workflows"
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedFilter={searchBy}
        onFilterChange={setSearchBy}
        filterOptions={filterOptions}
      />
      
      <div style={{ padding: '2rem', boxSizing: 'border-box', maxWidth: '100%' }}>
        <DataTable 
          columns={columns} 
          data={filteredWorkflows} 
          darkMode={darkMode} 
          selectable={true}
          isLoading={isLoading}
          initialSort={{ key: 'createdAt', direction: 'desc' }}
          pagination={true}
          defaultPageSize={6}
          pageSizeOptions={[6, 10, 25, 50, 100]}
        />
      </div>

      <FAButton
        darkMode={darkMode}
        onClick={() => { setNewWorkflowData(initialWorkflowState); setIsCreateModalOpen(true); }}
        icon={AddAutomationWorkflowSVG}
      />

      {/* VIEW MODAL */}
      <ExtraLargeModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Inspect Automation Workflow: ${viewWorkflow?.name}`}
        icon={<i className="bx bx-network-chart"></i>}
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setIsViewModalOpen(false)}
              style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: darkMode ? '#374151' : '#e5e7eb', fontFamily: 'Bodoni Moda Variable, serif', border: 'none', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}
            >
              Close
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', minHeight: '450px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem' }}>
                  {viewWorkflow?.name}
                </h3>
                {!viewWorkflow?.archived ? (
                  <span style={{ padding: '0.15rem 0.5rem', backgroundColor: darkMode ? '#064e3b' : '#dcfce7', color: darkMode ? '#34d399' : '#166534', fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>ACTIVE</span>
                ) : (
                  <span style={{ padding: '0.15rem 0.5rem', backgroundColor: darkMode ? '#7f1d1d' : '#fee2e2', color: darkMode ? '#f87171' : '#991b1b', fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>ARCHIVED</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.5 }}>
                {viewWorkflow?.description || 'No description provided.'}
              </p>
            </div>
            <div style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', padding: '1.25rem' }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Workflow Configuration
              </h4>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Platform / Tool</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 600 }}>
                  {viewWorkflow?.tool || 'Unknown Tool'}
                </span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Vector Factor (Priority)</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewWorkflow?.vectorFactor || 0}
                </span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Health Status</span>
                {viewWorkflow?.pingSuccess ? (
                  <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                    <i className="bx bx-check-circle" style={{ marginRight: '4px' }}></i> Passed Ping Test
                  </span>
                ) : (
                  <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic' }}>
                    Untested / Failed
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              <div>Created: {viewWorkflow?.createdAt ? new Date(viewWorkflow.createdAt).toLocaleString() : ''}</div>
              {viewWorkflow?.updatedAt && <div>Last Updated: {new Date(viewWorkflow.updatedAt).toLocaleString()}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>Endpoints</h4>
              <div style={{ marginTop: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Trigger URL</span>
                <div style={{ marginTop: '0.25rem', padding: '0.75rem', backgroundColor: darkMode ? '#111827' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#60a5fa' : '#2563eb', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {viewWorkflow?.triggerURL || 'Not specified'}
                </div>
              </div>
              {viewWorkflow?.callbackURL && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Callback URL (Optional)</span>
                  <div style={{ marginTop: '0.25rem', padding: '0.75rem', backgroundColor: darkMode ? '#111827' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {viewWorkflow?.callbackURL}
                  </div>
                </div>
              )}
            </div>
            <hr style={{ borderColor: darkMode ? '#374151' : '#e5e7eb', margin: '0.5rem 0' }} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '0.9rem' }}>Input Parameters</h4>
                {viewWorkflow?.inputParameters?.filter(p => p.variable.trim() !== '').length ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.875rem' }}>
                    {viewWorkflow.inputParameters.filter(p => p.variable.trim() !== '').map((param: any, i: number) => (
                      <li key={i} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code style={{ color: darkMode ? '#fca5a5' : '#dc2626' }}>{param.variable}</code>
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#d1d5db' : '#4b5563', fontWeight: 600, letterSpacing: '0.02em' }}>
                          {param.type || 'String'}
                        </span>
                        {param.isRequired && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>(Req)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>None defined.</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '0.9rem' }}>Output Variables</h4>
                {viewWorkflow?.outputVariables?.filter(p => p.variable.trim() !== '').length ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.875rem' }}>
                    {viewWorkflow.outputVariables.filter(p => p.variable.trim() !== '').map((param: any, i: number) => (
                      <li key={i} style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <code style={{ color: darkMode ? '#6ee7b7' : '#059669' }}>{param.variable}</code>
                        <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: darkMode ? '#374151' : '#e5e7eb', color: darkMode ? '#d1d5db' : '#4b5563', fontWeight: 600, letterSpacing: '0.02em' }}>
                          {param.type || 'String'}
                        </span>
                        {param.isRequired && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>(Req)</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>None defined.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </ExtraLargeModal>

      <FullScreenModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Automation Workflow Synopsis"
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
              disabled={!isWorkflowValid}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: isWorkflowValid ? 'pointer' : 'not-allowed', opacity: isWorkflowValid ? 1 : 0.5 }}
            >
              Save Workflow
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '2rem', borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
            <div>
              <label style={labelStyle}>Workflow Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" name="name" value={newWorkflowData.name} onChange={handleCreateTextChange}
                placeholder="e.g., Salesforce Lead Generator"
                style={{ ...inputStyle, borderColor: isNameDuplicate ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db') }}
              />
              {isNameDuplicate && <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>A workflow with this name already exists.</p>}
            </div>
            
            <div>
              <label style={labelStyle}>Platform Tool <span style={{ color: '#ef4444' }}>*</span></label>
              <select name="tool" value={newWorkflowData.tool || ''} onChange={handleCreateTextChange} style={inputStyle}>
                <option value="" disabled>Select an Automation Platform...</option>
                <option value="N8N">n8n</option>
                <option value="ZAPIER">Zapier</option>
                <option value="MAKE">Make</option>
                <option value="PIPEDREAM">Pipedream</option>
              </select>
            </div>
            
            <div>
              <label style={labelStyle}>Description <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea name="description" value={newWorkflowData.description || ''} onChange={handleCreateTextChange} placeholder="What does this workflow do when triggered?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Vector Factor (Priority Weight)</label>
                <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>
                  {newWorkflowData.vectorFactor || 0}
                </span>
              </div>
              <input 
                type="range" 
                name="vectorFactor" 
                min="0" 
                max="10" 
                step="1"
                value={newWorkflowData.vectorFactor || 0} 
                onChange={handleCreateNumberChange} 
                style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer', marginTop: '0.5rem' }} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', marginTop: '0.25rem' }}>
                <span>0 (Low)</span>
                <span>10 (High)</span>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Determines priority when Bedrock Agents select between overlapping tools.
              </p>
            </div>
            
            <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" name="archived" checked={newWorkflowData.archived || false} onChange={handleCreateToggleChange} style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }} />
                <span style={{ fontWeight: 500, color: darkMode ? '#f9fafb' : '#111827' }}>Archive this Workflow (Inactive)</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Webhook Trigger URL <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="url" 
                name="triggerURL" 
                value={newWorkflowData.triggerURL || ''} 
                onChange={handleCreateTextChange} 
                placeholder="https://hook.us1.make.com/..." 
                style={{ 
                  ...inputStyle, 
                  borderColor: (newWorkflowData.triggerURL && !isValidTrigger) ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db')
                }} 
                autoComplete="off" 
                data-1p-ignore
              />
              {newWorkflowData.triggerURL && !isValidTrigger && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>Please enter a valid HTTP/HTTPS URL.</p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Callback URL (Optional)</label>
              <input 
                type="url" 
                name="callbackURL" 
                value={newWorkflowData.callbackURL || ''} 
                onChange={handleCreateTextChange} 
                placeholder="https://api.yourdomain.com/webhook/callback" 
                style={{ 
                  ...inputStyle, 
                  borderColor: (newWorkflowData.callbackURL && !isValidCallback) ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db')
                }} 
                autoComplete="off" 
                data-1p-ignore
              />
              {newWorkflowData.callbackURL && !isValidCallback && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>Please enter a valid HTTP/HTTPS URL.</p>
              )}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="checkbox" name="requiresAuth" checked={newWorkflowData.requiresAuth || false} onChange={handleCreateToggleChange} style={{ cursor: 'pointer' }} />
              <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Authentication Required</span>
            </div>

            <div style={{
              maxHeight: newWorkflowData.requiresAuth ? '100px' : '0',
              opacity: newWorkflowData.requiresAuth ? 1 : 0,
              overflow: 'hidden',
              transition: 'all 0.3s ease-in-out',
              marginTop: newWorkflowData.requiresAuth ? '0.75rem' : '0'
            }}>
              <label style={labelStyle}>Authentication Token</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showCreateToken ? "text" : "password"} 
                  name="authHeader" 
                  value={newWorkflowData.authHeader || ''} 
                  onChange={handleCreateTextChange} 
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
            <hr style={{ borderColor: darkMode ? '#374151' : '#e5e7eb', margin: '0.5rem 0' }} />
            
            <div style={{ display: 'flex', gap: '1rem', flexGrow: 1 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Input Parameters</h4>
                  <button onClick={() => handleCreateAddParameter('input')} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', backgroundColor: darkMode ? '#374151' : '#e5e7eb', border: 'none', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>+ Add</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!newWorkflowData.inputParameters?.length && <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: '0.5rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.8rem' }}>No input parameters.</div>}
                  {newWorkflowData.inputParameters?.map((param, index) => (
                    <div key={`input-${index}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, boxSizing: 'border-box' }}>
                      <input type="text" value={param.variable} onChange={(e) => handleCreateUpdateParameter('input', index, 'variable', e.target.value)} placeholder="e.g. emailAddress" style={{ ...inputStyle, flexGrow: 1, padding: '0.4rem', margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '100px' }} />
                      
                      <select value={param.type || 'String'} onChange={(e) => handleCreateUpdateParameter('input', index, 'type', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.5rem', margin: 0, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                        {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={param.isRequired} onChange={(e) => handleCreateUpdateParameter('input', index, 'isRequired', e.target.checked)} /> Req
                      </label>
                      <button onClick={() => handleCreateRemoveParameter('input', index)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}><i className="bx bx-trash"></i></button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Output Variables</h4>
                  <button onClick={() => handleCreateAddParameter('output')} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', backgroundColor: darkMode ? '#374151' : '#e5e7eb', border: 'none', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>+ Add</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!newWorkflowData.outputVariables?.length && <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: '0.5rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.8rem' }}>No output variables.</div>}
                  {newWorkflowData.outputVariables?.map((param, index) => (
                    <div key={`output-${index}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, boxSizing: 'border-box' }}>
                      <input type="text" value={param.variable} onChange={(e) => handleCreateUpdateParameter('output', index, 'variable', e.target.value)} placeholder="e.g. status" style={{ ...inputStyle, flexGrow: 1, padding: '0.4rem', margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '100px' }} />
                      
                      <select value={param.type || 'String'} onChange={(e) => handleCreateUpdateParameter('output', index, 'type', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.5rem', margin: 0, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                        {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={param.isRequired} onChange={(e) => handleCreateUpdateParameter('output', index, 'isRequired', e.target.checked)} /> Req
                      </label>
                      <button onClick={() => handleCreateRemoveParameter('output', index)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}><i className="bx bx-trash"></i></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FullScreenModal>

      <FullScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editWorkflow ? `Editing Automation Workflow Synopsis: ${editWorkflow.name}` : 'Edit Automation Workflow Synopsis'}
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button onClick={() => setIsEditModalOpen(false)} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}>Cancel</button>
            <button onClick={handleEditSubmit} disabled={!isEditValid} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: isEditValid ? 'pointer' : 'not-allowed', opacity: isEditValid ? 1 : 0.5 }}>Save Changes</button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '2rem', borderRight: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
            <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" name="archived" checked={editWorkflowData.archived || false} onChange={handleEditToggleChange} style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }} />
                <span style={{ fontWeight: 500, color: darkMode ? '#f9fafb' : '#111827' }}>Workflow is Archived</span>
              </label>
            </div>
            <div>
              <label style={labelStyle}>Workflow Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" name="name" value={editWorkflowData.name || ''} onChange={handleEditTextChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Platform Tool <span style={{ color: '#ef4444' }}>*</span></label>
              <select name="tool" value={editWorkflowData.tool || ''} onChange={handleEditTextChange} style={inputStyle}>
                <option value="" disabled>Select an Automation Platform...</option>
                <option value="N8N">n8n</option>
                <option value="ZAPIER">Zapier</option>
                <option value="MAKE">Make</option>
                <option value="PIPEDREAM">Pipedream</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea name="description" value={editWorkflowData.description || ''} onChange={handleEditTextChange} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={labelStyle}>Vector Factor (Priority Weight)</label>
                <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>
                  {editWorkflowData.vectorFactor || 0}
                </span>
              </div>
              <input 
                type="range" 
                name="vectorFactor" 
                min="0" 
                max="10" 
                step="1"
                value={editWorkflowData.vectorFactor || 0} 
                onChange={handleEditNumberChange} 
                style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer', marginTop: '0.5rem' }} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', marginTop: '0.25rem' }}>
                <span>0 (Low)</span>
                <span>10 (High)</span>
              </div>
            </div>
            {editWorkflow && (
              <div style={{ marginTop: 'auto', paddingTop: '1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                <div style={{ marginBottom: '0.25rem' }}>Created: {new Date(editWorkflow.createdAt || '').toLocaleDateString()}</div>
                {editWorkflow.updatedAt && <div>Last Modified: {new Date(editWorkflow.updatedAt || '').toLocaleDateString()}</div>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}> 
            <div>
              <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Endpoint Configuration</h3>
              <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
                <label style={labelStyle}>Trigger URL <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="url" 
                  name="triggerURL" 
                  value={editWorkflowData.triggerURL || ''} 
                  onChange={handleEditTextChange} 
                  style={{ 
                    ...inputStyle, 
                    fontFamily: 'monospace',
                    borderColor: (editWorkflowData.triggerURL && !isEditValidTrigger) ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db')
                  }}
                  autoComplete="off"
                  data-1p-ignore
                />
                {editWorkflowData.triggerURL && !isEditValidTrigger && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>Please enter a valid HTTP/HTTPS URL.</p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Callback URL (Optional)</label>
                <input 
                  type="url" 
                  name="callbackURL" 
                  value={editWorkflowData.callbackURL || ''} 
                  onChange={handleEditTextChange} 
                  style={{ 
                    ...inputStyle, 
                    fontFamily: 'monospace',
                    borderColor: (editWorkflowData.callbackURL && !isEditValidCallback) ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db')
                  }}
                  autoComplete="off"
                  data-1p-ignore
                />
                {editWorkflowData.callbackURL && !isEditValidCallback && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>Please enter a valid HTTP/HTTPS URL.</p>
                )}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" name="requiresAuth" checked={editWorkflowData.requiresAuth || false} onChange={handleEditToggleChange} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Authentication Required</span>
              </div>

              <div style={{
                maxHeight: editWorkflowData.requiresAuth ? '100px' : '0',
                opacity: editWorkflowData.requiresAuth ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                marginTop: editWorkflowData.requiresAuth ? '0.75rem' : '0'
              }}>
                <label style={labelStyle}>Authentication Token</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showEditToken ? "text" : "password"} 
                    name="authHeader" 
                    value={editWorkflowData.authHeader || ''} 
                    onChange={handleEditTextChange} 
                    placeholder="Bearer token or API key..." 
                    style={{ ...inputStyle, paddingRight: '2.5rem' }}
                    autoComplete="new-password"
                    data-1p-ignore 
                  />
                  <i 
                    className={`bx ${showEditToken ? 'bx-hide' : 'bx-show'}`} 
                    onClick={() => setShowEditToken(!showEditToken)} 
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '1.1rem' }}
                  ></i>
                </div>
              </div>
            </div>
            <hr style={{ borderColor: darkMode ? '#374151' : '#e5e7eb', margin: '0.5rem 0' }} />
            
            <div style={{ display: 'flex', gap: '1rem', flexGrow: 1 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Input Parameters</h4>
                  <button onClick={() => handleEditAddParameter('input')} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', backgroundColor: darkMode ? '#374151' : '#e5e7eb', border: 'none', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>+ Add</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!editWorkflowData.inputParameters?.length && <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: '0.5rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.8rem' }}>No input parameters.</div>}
                  {editWorkflowData.inputParameters?.map((param, index) => (
                    <div key={`input-${index}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, boxSizing: 'border-box' }}>
                      <input type="text" value={param.variable} onChange={(e) => handleEditUpdateParameter('input', index, 'variable', e.target.value)} style={{ ...inputStyle, flexGrow: 1, padding: '0.4rem', margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '100px' }} />
                      
                      <select value={param.type || 'String'} onChange={(e) => handleEditUpdateParameter('input', index, 'type', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.5rem', margin: 0, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                        {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={param.isRequired} onChange={(e) => handleEditUpdateParameter('input', index, 'isRequired', e.target.checked)} /> Req
                      </label>
                      <button onClick={() => handleEditRemoveParameter('input', index)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}><i className="bx bx-trash"></i></button>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Output Variables</h4>
                  <button onClick={() => handleEditAddParameter('output')} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', backgroundColor: darkMode ? '#374151' : '#e5e7eb', border: 'none', color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>+ Add</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!editWorkflowData.outputVariables?.length && <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`, borderRadius: '0.5rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.8rem' }}>No output variables.</div>}
                  {editWorkflowData.outputVariables?.map((param, index) => (
                    <div key={`output-${index}`} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, boxSizing: 'border-box' }}>
                      <input type="text" value={param.variable} onChange={(e) => handleEditUpdateParameter('output', index, 'variable', e.target.value)} style={{ ...inputStyle, flexGrow: 1, padding: '0.4rem', margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', minWidth: '100px' }} />
                      
                      <select value={param.type || 'String'} onChange={(e) => handleEditUpdateParameter('output', index, 'type', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.3rem 0.5rem', margin: 0, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                        {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', cursor: 'pointer', flexShrink: 0 }}>
                        <input type="checkbox" checked={param.isRequired} onChange={(e) => handleEditUpdateParameter('output', index, 'isRequired', e.target.checked)} /> Req
                      </label>
                      <button onClick={() => handleEditRemoveParameter('output', index)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', flexShrink: 0 }}><i className="bx bx-trash"></i></button>
                    </div>
                  ))}
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
        title="Delete Automation Workflow Synopsis"
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button className="bottom-right-modal-button" onClick={() => setIsDeleteModalOpen(false)} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDeleteWorkflow} style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: 1 }}>Confirm</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}>
            Deleting Workflow Tool: <strong>{deleteWorkflow?.name}</strong> from database records. 
          </p>
          {deleteWorkflow?.profiles && deleteWorkflow.profiles.length > 0 && (
            <div style={{ padding: '0.75rem', backgroundColor: darkMode ? '#450a0a' : '#fef2f2', borderRadius: '0.375rem', border: `1px solid ${darkMode ? '#7f1d1d' : '#f87171'}` }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#fca5a5' : '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> Active Agents Detected
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: darkMode ? '#fecaca' : '#7f1d1d', lineHeight: 1.4 }}>
                This workflow is actively utilized as a tool by <strong>{deleteWorkflow.profiles.length}</strong> Context Profile(s). Deleting it will revoke their ability to execute this automation immediately.
              </p>
            </div>
          )}
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}>Are you sure you want to proceed? This action cannot be undone.</p>
        </div>
      </BottomRightModal>
    </>
  );
};

export default AutomationWorkflowsUI;