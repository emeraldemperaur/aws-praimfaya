import { useEffect, useState } from "react";
import TitleRibbon from "../components/titleribbon";
import type { ColumnDef } from "../components/datatable";
import type { FoundationModel } from "../data/foundationmodel";
import novaIcon from '../assets/nova-icon.png';
import gptIcon from '../assets/gpt-oss-icon.png';
import DataTable from "../components/datatable";
import BottomRightModal from "../components/bottomrightmodal";
import { seedDataFoundationModels } from "../data/seeddata";
import FullScreenModal from "../components/fullscreenmodal";
import ExtraLargeModal from "../components/extralargemodal";

const FoundationModelsUI = ({ darkMode }: { darkMode: boolean }) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewFoundationModel, setViewFoundationModel] = useState<FoundationModel | null>(null);
  const [editFoundationModel, setEditFoundationModel] = useState<FoundationModel | null>(null);
  const [editFoundationModelData, setEditFoundationModelData] = useState<Partial<FoundationModel>>({});
  const [disableFoundationModel, setDisableFoundationModel] = useState<FoundationModel | null>(null);
  
  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode]);

  useEffect(() => {
    if (editFoundationModel) {
      setEditFoundationModelData({
        name: editFoundationModel.name,
        provider: editFoundationModel.provider,
        apiIdentifier: editFoundationModel.apiIdentifier,
        modality: editFoundationModel.modality,
        contextWindowTokens: editFoundationModel.contextWindowTokens,
        isActive: editFoundationModel.isActive ?? false,
      });
    }
  }, [editFoundationModel]);

  const columns: ColumnDef<FoundationModel>[] = [
      {
        header: 'Model',
        accessor: 'model',
        render: (row) => (
          <div className="tbl-cell-user">
            <img src={row.provider?.toLocaleLowerCase().includes('amazon') ? novaIcon : gptIcon} alt={row.name} />
            <div className="user-info">
              <span className="primary-text">{row.name}</span>
              <span className="secondary-text">{row.modality}</span>
            </div>
          </div>
        )
      },
      {
        header: 'Context Window',
        accessor: 'contextWindow',
        render: (row) => (
          <div className="tbl-cell-stacked">
            <span className="primary-text">{row.profiles?.length || 0} Profiles</span>
            <span className="secondary-text">{row.contextWindowTokens || 0} Context Window Tokens</span>
          </div>
        )
      },
      {
        header: 'Modality',
        accessor: 'modality',
        render: (row) => {
          let badgeClass = 'info';
          if (row.modality?.toLocaleLowerCase().includes('amazon')) badgeClass = 'info';
          if (row.modality?.toLocaleLowerCase().includes('openai')) badgeClass = 'success';
  
          return <span className={`tbl-badge ${badgeClass}`}>{row.modality}</span>;
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
                console.log('View button clicked for foundation model:', row.id);
                setViewFoundationModel(row);
                setIsViewModalOpen(true);
              }}
            >
              Inspect
            </button>
            <button 
              className="tbl-action-btn edit-btn" 
              onClick={() => {
                console.log('Edit button clicked for foundation model:', row.id);
                setEditFoundationModel(row);
                setIsEditModalOpen(true);
              }}
            >
              Modify
            </button>
            <button 
              className="tbl-action-btn delete-btn" 
              onClick={() => {
              console.log('Disable button clicked for foundation model:', row.id);
              setDisableFoundationModel(row);
              setIsDeleteModalOpen(true);
            }}
            >
              {row.isActive ? <a>Disable</a> : <a>Enable</a>}
            </button>
          </div>
        )
      }
    ];
  
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setEditFoundationModelData(prev => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
      setEditFoundationModelData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditFoundationModelData(prev => ({ ...prev, [name]: checked }));
  };

  const isEditValid = editFoundationModelData.name?.trim() !== '' && editFoundationModelData.apiIdentifier?.trim() !== '';

  const handleEditSubmit = async () => {
    console.log('Saving Foundation Model Updates:', editFoundationModel?.id, editFoundationModelData);
    // TODO: Add Amplify Data update mutation here
    setIsEditModalOpen(false);
  };

  const handleDisableFoundationModel = () => {
    if (!disableFoundationModel) return;

    console.log('Disabling foundation model:', disableFoundationModel.id);
    // Add API call here
    
    // Clear and close after submitting
    setDisableFoundationModel(null);
    setIsDeleteModalOpen(false);
  };  

  const inputStyle = {
    width: '100%', padding: '0.75rem', borderRadius: '0.375rem',
    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#f9fafb' : '#111827',
    fontFamily: 'inherit'
  };

  const disabledInputStyle = {
    ...inputStyle,
    backgroundColor: darkMode ? '#111827' : '#f3f4f6',
    color: darkMode ? '#9ca3af' : '#6b7280',
    cursor: 'not-allowed'
  };

  const labelStyle = {
    display: 'block', marginBottom: '0.5rem', fontWeight: 500,
    fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151'
  };

  return (
    <>
      <TitleRibbon title="Foundation Models" darkMode={darkMode} typewriterFX textAlignment="right"/>
      <div style={{ padding: '2rem' }}>
            <DataTable 
                columns={columns} 
                data={seedDataFoundationModels} 
                darkMode={darkMode} 
                selectable={false}
            />
      </div>
      <ExtraLargeModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Inspect Model: ${viewFoundationModel?.name}`}
        icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.5rem', height: '1.5rem', display: 'inline-block', verticalAlign: 'text-bottom' }}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>} // AI Chip icon
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
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', minHeight: '350px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem' }}>
                  {viewFoundationModel?.name}
                </h3>
                {viewFoundationModel?.isActive ? (
                  <span style={{ padding: '0.15rem 0.5rem', backgroundColor: darkMode ? '#064e3b' : '#dcfce7', color: darkMode ? '#34d399' : '#166534', fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>ACTIVE</span>
                ) : (
                  <span style={{ padding: '0.15rem 0.5rem', backgroundColor: darkMode ? '#7f1d1d' : '#fee2e2', color: darkMode ? '#f87171' : '#991b1b', fontSize: '0.7rem', borderRadius: '999px', fontWeight: 600 }}>INACTIVE</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.5 }}>
                Provider: <strong>{viewFoundationModel?.provider || 'Unknown'}</strong>
              </p>
            </div>

            <div style={{ 
              backgroundColor: darkMode ? '#1f2937' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem', 
              padding: '1.25rem'
            }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                API Configuration
              </h4>
              
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Strict Identifier</span>
                <span style={{ 
                  display: 'block', 
                  marginTop: '0.5rem', 
                  padding: '0.5rem',
                  backgroundColor: darkMode ? '#111827' : '#ffffff',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '4px',
                  fontSize: '0.875rem', 
                  color: darkMode ? '#d1d5db' : '#4b5563', 
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {viewFoundationModel?.apiIdentifier}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              <div>Created: {viewFoundationModel?.createdAt ? new Date(viewFoundationModel.createdAt).toLocaleString() : ''}</div>
              {viewFoundationModel?.updatedAt && <div>Last Updated: {new Date(viewFoundationModel.updatedAt).toLocaleString()}</div>}
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modality</span>
                <span style={{ 
                  display: 'inline-block', 
                  marginTop: '0.25rem', 
                  padding: '0.25rem 0.5rem', 
                  backgroundColor: viewFoundationModel?.modality === 'MULTIMODAL' ? (darkMode ? '#064e3b' : '#dcfce7') : 
                                   viewFoundationModel?.modality === 'EMBEDDING' ? (darkMode ? '#713f12' : '#fef08a') : 
                                   (darkMode ? '#1e3a8a' : '#dbeafe'), 
                  color: viewFoundationModel?.modality === 'MULTIMODAL' ? (darkMode ? '#34d399' : '#166534') : 
                         viewFoundationModel?.modality === 'EMBEDDING' ? (darkMode ? '#fde047' : '#854d0e') : 
                         (darkMode ? '#60a5fa' : '#1e40af'), 
                  borderRadius: '4px', 
                  fontSize: '0.875rem', 
                  fontWeight: 600 
                }}>
                  {viewFoundationModel?.modality || 'UNKNOWN'}
                </span>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                  {viewFoundationModel?.modality === 'EMBEDDING' 
                    ? 'Generates mathematical vectors from input data.' 
                    : viewFoundationModel?.modality === 'MULTIMODAL' 
                    ? 'Processes both text and image/vision inputs.' 
                    : 'Processes standard conversational text.'}
                </p>
              </div>

              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {viewFoundationModel?.modality === 'EMBEDDING' ? 'Output Dimensions' : 'Context Window'}
                </span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '1.25rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 600 }}>
                  {viewFoundationModel?.contextWindowTokens?.toLocaleString() || 'N/A'}
                </span>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                  {viewFoundationModel?.modality === 'EMBEDDING'
                    ? 'The vector length required when matching to a database index.'
                    : 'Maximum input tokens permitted per API request.'}
                </p>
              </div>
            </div>

            <hr style={{ borderColor: darkMode ? '#374151' : '#e5e7eb', borderTopWidth: 1, borderBottomWidth: 0, margin: '0.5rem 0' }} />

            <div>
              <h4 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>System Impact</h4>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                This model currently powers <strong>{viewFoundationModel?.profiles?.length || 0}</strong> active Context Profiles.
              </p>
              
              {viewFoundationModel?.profiles && viewFoundationModel.profiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {viewFoundationModel.profiles.map(profile => (
                    <span key={profile.id} style={{ 
                      padding: '0.25rem 0.5rem', 
                      backgroundColor: darkMode ? '#374151' : '#e5e7eb', 
                      color: darkMode ? '#d1d5db' : '#374151', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem' 
                    }}>
                      {profile.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </ExtraLargeModal>
      <FullScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editFoundationModel ? `Modify Model: ${editFoundationModel.name}` : 'Modify Model'}
        darkMode={darkMode}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', width: '100%' }}>
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="input-typography"
              style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#f9fafb' : '#111827', borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleEditSubmit}
              disabled={!isEditValid}
              className="input-typography"
              style={{ 
                padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px',
                cursor: isEditValid ? 'pointer' : 'not-allowed', opacity: isEditValid ? 1 : 0.5
              }}
            >
              Save Configuration
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', height: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}` }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox"
                  name="isActive"
                  checked={editFoundationModelData.isActive || false}
                  onChange={handleEditToggleChange}
                  style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.75rem', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ display: 'block', fontWeight: 500, color: darkMode ? '#f9fafb' : '#111827' }}>
                    Model is Active
                  </span>
                  <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                    Unchecking this disables the model across all Context Profiles.
                  </span>
                </div>
              </label>
            </div>

            <div>
              <label style={labelStyle}>Display Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                name="name"
                value={editFoundationModelData.name || ''}
                onChange={handleEditChange}
                className="input-typography"
                placeholder="e.g., Claude 3 Sonnet"
                style={inputStyle}
              />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                The human-readable name shown in UI dropdowns.
              </p>
            </div>

            <div>
              <label style={labelStyle}>API Identifier (Immutable) <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                value={editFoundationModelData.apiIdentifier || ''}
                readOnly
                className="input-typography"
                style={disabledInputStyle}
              />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                The exact string passed to the SDK (e.g., anthropic.claude-3-sonnet-20240229-v1:0). This cannot be changed after creation.
              </p>
            </div>
            
            <div>
              <label style={labelStyle}>Provider</label>
              <select 
                name="provider"
                value={editFoundationModelData.provider || ''}
                onChange={handleEditChange}
                className="input-typography"
                style={inputStyle}
              >
                <option value="AMAZON">Amazon AWS</option>
                <option value="ANTHROPIC">Anthropic</option>
                <option value="META">Meta</option>
                <option value="GOOGLE">Google</option>
                <option value="OPENAI">OpenAI</option>
                <option value="COHERE">Cohere</option>
                <option value="MISTRAL">Mistral AI</option>
              </select>
            </div>

          </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div>
          <label style={labelStyle}>Modality</label>
          <select 
            name="modality"
            value={editFoundationModelData.modality || ''}
            onChange={handleEditChange}
            className="input-typography"
            style={inputStyle}
          >
            <option value="TEXT">Text Only (Chat)</option>
            <option value="MULTIMODAL">Multimodal (Text + Vision)</option>
            <option value="EMBEDDING">Embedding (Vector Generation)</option>
            <option value="IMAGE">Image Generation</option>
          </select>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            Defines the type of data this model processes (e.g., text, images, vectors) and dictates which system features it can support.
          </p>
        </div>

        <div>
          <label style={labelStyle}>
            {editFoundationModelData.modality === 'EMBEDDING' 
              ? 'Max Output Dimensions' 
              : 'Max Context Window (Tokens)'}
          </label>
          <input 
            type="number" 
            name="contextWindowTokens"
            value={editFoundationModelData.contextWindowTokens || ''}
            onChange={handleEditChange}
            className="input-typography"
            placeholder={editFoundationModelData.modality === 'EMBEDDING' ? 'e.g., 1536' : 'e.g., 200000'}
            style={inputStyle}
          />
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            {editFoundationModelData.modality === 'EMBEDDING'
              ? 'The structural length of the generated vector coordinates. Crucial for matching target database collection matrices.'
              : 'The maximum number of input tokens this model supports. Used to calculate text-chunking and RAG payload limits.'}
          </p>
        </div>

        {editFoundationModel && (
          <div style={{ marginTop: 'auto', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>System Impact</h4>
            <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              This model is currently powering <strong>{editFoundationModel.profiles?.length || 0}</strong> Context Profiles. 
              Disabling it will cause those profiles to fallback to system defaults.
            </p>
            <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              <div>Added: {editFoundationModel.createdAt ? new Date(editFoundationModel.createdAt).toLocaleDateString() : 'Unknown'}</div>
            </div>
          </div>
        )}

        </div>

        </div>
      </FullScreenModal>
      <BottomRightModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        icon={<i className="bx bx-trash" />}
        title={`${disableFoundationModel?.isActive ? 'Disable' : 'Enable'} Foundation Model`}
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
              onClick={handleDisableFoundationModel}
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
            {disableFoundationModel?.isActive ? 'Disabling' : 'Enabling'} Foundation Model: <strong>{disableFoundationModel?.name}</strong> 
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}> 
            This will {disableFoundationModel?.isActive ? 'prevent' : 'allow'} it {disableFoundationModel?.isActive ? 'from being used' : 'to be used'} in Context Profiles and any associated API calls.
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#ccc' : '#666' }}> 
            Are you sure you want to proceed? 
          </p>
        </div>
      </BottomRightModal>
    </>
  );
};

export default FoundationModelsUI;