import { useEffect, useRef, useState, useMemo } from "react";
import FAButton from "../components/floatingactionbutton";
import TitleRibbon from "../components/titleribbon";
import SearchRibbon from "../components/searchribbon";
import type { ColumnDef } from "../components/datatable";
import DataTable from "../components/datatable";
import BottomRightModal from "../components/bottomrightmodal";
import ExtraLargeModal from "../components/extralargemodal";
import { AddVectorCollectionSVG, getModelIcon } from "../utils/voltaire";
import { uploadData } from 'aws-amplify/storage';
import FullScreenModal from "../components/fullscreenmodal";
import { generateClient } from "aws-amplify/api";
import type { UIVectorCollection } from "../data/vectorcollection";
import { getUserEmail } from "../utils/asimov";
import { fetchAuthSession } from 'aws-amplify/auth';

const DEFAULT_COLLECTION_STATE = {
  name: '',
  description: '',
  embeddingModel: '',
  vectorDimension: 1536,
};

const VectorCollectionsUI = ({ darkMode }: { darkMode: boolean }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('name');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewVectorCollection, setViewVectorCollection] = useState<UIVectorCollection | null>(null);
  const [deleteVectorCollection, setDeleteVectorCollection] = useState<UIVectorCollection | null>(null);
  const [editVectorCollection, setEditVectorCollection] = useState<UIVectorCollection | null>(null);
  const [newCollectionData, setNewCollectionData] = useState<Partial<UIVectorCollection>>(DEFAULT_COLLECTION_STATE);
  const [editVectorCollectionData, setEditVectorCollectionData] = useState<Partial<UIVectorCollection>>({});
  const [vectorDocuments, setVectorDocuments] = useState<any[]>([]); 
  const hiddenDirectS3Input = useRef<HTMLInputElement>(null);
  const client = generateClient() as any;
  const vectorCollectionsClient = client.models.VectorCollection;
  const [vectorCollections, setVectorCollections] = useState<UIVectorCollection[]>([]);
  const [foundationModels, setFoundationModels] = useState<any[]>([]); 

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
  }, [darkMode, vectorCollections.length]);

  useEffect(() => {
    const sub = vectorCollectionsClient.observeQuery({
      selectionSet: [
        'id', 
        'name', 
        'description', 
        'embeddingModel', 
        'vectorDimension', 
        'createdAt', 
        'updatedAt', 
        'profiles.*', 
        'documents.*'
      ]
    }).subscribe({
      next: (data: any) => {
        setVectorCollections(data.items as UIVectorCollection[]);
        setIsLoading(false);
      },
      error: (err: any) => {
        console.error("Error fetching vector collections:", err);
        setIsLoading(false);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const fmSub = client.models.FoundationModel.observeQuery().subscribe({
      next: (data: any) => {
        const embeddingModels = data.items.filter((m: any) => m.modality === 'EMBEDDING');
        setFoundationModels(embeddingModels);
      },
      error: (err: any) => console.error("Error fetching foundation models:", err)
    });
    return () => fmSub.unsubscribe();
  }, []);

  useEffect(() => {
    if (editVectorCollection) {
      setEditVectorCollectionData({
        name: editVectorCollection.name,
        description: editVectorCollection.description || '',
        embeddingModel: editVectorCollection.embeddingModel,
        vectorDimension: editVectorCollection.vectorDimension,
      });
      setVectorDocuments(editVectorCollection.documents || []);
    }
  }, [editVectorCollection]);

  const filterOptions = [
    { label: 'Name', value: 'name' },
    { label: 'Description', value: 'description' },
    { label: 'Embedding Model', value: 'embeddingModel' },
    { label: 'Vector Dimension', value: 'vectorDimension' },
    { label: 'Created By', value: 'createdBy' },
    { label: 'Date', value: 'createdAt' },
  ];

  const filteredCollections = useMemo(() => {
    if (!searchTerm.trim()) return vectorCollections;
    const lowerTerm = searchTerm.toLowerCase();

    return vectorCollections.filter(collection => {
      switch (searchBy) {
        case 'name':
          return collection.name?.toLowerCase().includes(lowerTerm);
        case 'description':
          return collection.description?.toLowerCase().includes(lowerTerm);
        case 'embeddingModel':
          return collection.embeddingModel?.toLowerCase().includes(lowerTerm);
        case 'vectorDimension':
          return collection.vectorDimension?.toString().includes(lowerTerm);
        case 'createdBy':
          return collection.createdBy?.toLowerCase().includes(lowerTerm);
        case 'createdAt':
          const dateString = collection.createdAt ? new Date(collection.createdAt).toLocaleDateString() : '';
          return collection.createdAt?.toLowerCase().includes(lowerTerm) || dateString.includes(lowerTerm);
        default:
          return true;
      }
    });
  }, [vectorCollections, searchTerm, searchBy]);

  const columns: ColumnDef<UIVectorCollection>[] = [
    {
      header: 'Name',
      accessor: 'name',
      sortable: true,
      render: (row) => (
        <div className="tbl-cell-user">
          <img src={getModelIcon(row.embeddingModel?.toLocaleLowerCase())} alt={row.name} />
          <div className="user-info">
            <span className="primary-text">{row.name}</span>
            <span className="secondary-text">{row.vectorDimension} Dimensions</span>
          </div>
        </div>
      )
    },
    {
      header: 'Contexts',
      accessor: 'profiles',
      sortable: true,
      render: (row) => (
        <div className="tbl-cell-stacked">
          <span className="primary-text">{row.profiles?.length || 0} {row.profiles?.length === 1 ? 'Profile' : 'Profiles'}</span>
          <span className="secondary-text">{row.description}</span>
        </div>
      )
    },
    {
      header: 'Embedding Model',
      accessor: 'embeddingModel',
      sortable: true,
      render: (row) => {
        let badgeClass = 'info';
        if (row.embeddingModel.toLocaleLowerCase().includes('amazon')) badgeClass = 'info';
        if (row.embeddingModel.toLocaleLowerCase().includes('openai')) badgeClass = 'success';

        return <span className={`tbl-badge ${badgeClass}`}>{row.embeddingModel}</span>;
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
                setViewVectorCollection(row);
                setIsViewModalOpen(true);
              }}
          >
            Inspect
          </button>
          <button 
            className="tbl-action-btn edit-btn" 
            onClick={() => {
              setEditVectorCollection(row);
              setIsEditModalOpen(true);
            }}
          >
            Manage
          </button>
          <button 
            className="tbl-action-btn delete-btn" 
            onClick={() => {
              setDeleteVectorCollection(row);
              setIsDeleteModalOpen(true);
            }}
          >
            Delete
          </button>
        </div>
      )
    }
  ];

  const handleCreateInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCollectionData(prev => ({ 
      ...prev, 
      [name]: name === 'vectorDimension' ? parseInt(value, 10) || 0 : value 
    }));
  };

  const normalizedNewName = newCollectionData.name?.trim().toLowerCase() || '';
  const isNameDuplicate = normalizedNewName !== '' && vectorCollections.some(
    collection => collection.name.toLowerCase() === normalizedNewName
  );

  const isCollectionValid = newCollectionData.name?.trim() !== '' && 
                            newCollectionData.embeddingModel?.trim() !== '' && 
                            !isNameDuplicate;

  const handleCreateSubmit = async () => {
    if (isNameDuplicate) {
      alert("A Vector Collection with this name already exists. Please choose a unique name.");
      return;
    }

    try {
      const { data: newCollection, errors } = await vectorCollectionsClient.create({
        name: newCollectionData.name!.trim(),
        description: newCollectionData.description?.trim() || null,
        embeddingModel: newCollectionData.embeddingModel!,
        vectorDimension: newCollectionData.vectorDimension!,
        createdBy: getUserEmail ? await getUserEmail() : 'Unknown User',
      });
      if (errors) throw new Error(errors[0].message);
      setVectorCollections(prev => {
        const alreadyExists = prev.some(collection => collection.id === newCollection.id);
        if (alreadyExists) return prev;
        return [newCollection, ...prev];
      });
      setNewCollectionData(DEFAULT_COLLECTION_STATE);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Failed to create Vector Collection:", error);
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditVectorCollectionData(prev => ({ 
      ...prev, 
      [name]: name === 'vectorDimension' ? parseInt(value, 10) || 0 : value 
    }));
  };

  const isEditValid = editVectorCollectionData.name?.trim() !== '' && editVectorCollectionData.embeddingModel?.trim() !== '';

  const handleEditSubmit = async () => {
    if (!editVectorCollection?.id) return;
    try {
      const { data: updatedCollection, errors } = await vectorCollectionsClient.update({
        id: editVectorCollection.id,
        name: editVectorCollectionData.name!.trim(),
        description: editVectorCollectionData.description?.trim() || null,
        embeddingModel: editVectorCollectionData.embeddingModel!,
        vectorDimension: editVectorCollectionData.vectorDimension!,
        updatedBy: getUserEmail ? await getUserEmail() : 'Unknown User',
      });

      if (errors) throw new Error(errors[0].message);
      setVectorCollections(prev => prev.map(item => 
        item.id === updatedCollection.id ? updatedCollection : item
      ));
      
      setIsEditModalOpen(false);
      setEditVectorCollection(null);
    } catch (error) {
      console.error("Failed to update Vector Collection:", error);
    }
  };

  const handleDeleteVectorCollection = async () => {
    if (!deleteVectorCollection?.id) return;
    try {
      const { errors } = await vectorCollectionsClient.delete({
        id: deleteVectorCollection.id
      });

      if (errors) throw new Error(errors[0].message);
      setVectorCollections(prev => prev.filter(item => item.id !== deleteVectorCollection.id));
      setDeleteVectorCollection(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Failed to delete Vector Collection:", error);
    }
  };  

  const handleDirectS3Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editVectorCollection?.id) return;

    try {
      // 1. Fetch Identity ID for pathing
      const session = await fetchAuthSession();
      const identityId = session.identityId;
      if (!identityId) throw new Error("Authentication required.");

      // 2. Build secure path
      const s3FilePath = `vector-collections/${identityId}/${editVectorCollection.id}/${file.name}`;
      const friendlySize = `${(file.size / 1024 / 1024).toFixed(2)} MB`;

      // 3. Optimistic UI update
      setVectorDocuments(prev => [...prev, 
        { 
          id: 'temp-' + Date.now().toString(), 
          name: file.name, 
          size: friendlySize,
          status: 'Uploading...'
        }
      ]);

      // 4. Upload raw file directly to S3 (Triggers Backend Lambda)
      const uploadTask = uploadData({
        path: s3FilePath,
        data: file,
        options: {
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) console.log(`Progress: ${Math.round((transferredBytes / totalBytes) * 100)}%`);
          }
        }
      });

      await uploadTask.result;
      setVectorDocuments(prev => prev.map(doc => 
        doc.name === file.name ? { ...doc, status: 'Processing...' } : doc
      ));
    } catch (error) {
      console.error('Upload Error:', error);
      setVectorDocuments(prev => prev.map(doc => 
        doc.name === file.name ? { ...doc, status: 'Failed' } : doc
      ));
    } finally {
      if (hiddenDirectS3Input.current) hiddenDirectS3Input.current.value = ''; 
    }
  };

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

  return (
    <>
      <TitleRibbon title="Vector Collections" darkMode={darkMode} typewriterFX textAlignment="right"/>
      <SearchRibbon 
        darkMode={darkMode}
        recordCount={filteredCollections.length}
        recordLabel="Vector Collections"
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedFilter={searchBy}
        onFilterChange={setSearchBy}
        filterOptions={filterOptions}
      />
      <div style={{ padding: '2rem' }}>
        <DataTable 
          columns={columns} 
          data={filteredCollections} 
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
        onClick={() => setIsCreateModalOpen(true)}
        icon={AddVectorCollectionSVG}
      />

      <ExtraLargeModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Inspect Collection: ${viewVectorCollection?.name}`}
        icon={<i className="bx bx-data"></i>} 
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
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', minHeight: '400px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflowX: 'hidden' }}>
            
            <div>
              <h3 style={{ margin: '0 0 0.5rem', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem' }}>
                {viewVectorCollection?.name}
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280', lineHeight: 1.5 }}>
                {viewVectorCollection?.description || 'No description provided.'}
              </p>
            </div>

            <div style={{ 
              backgroundColor: darkMode ? '#1f2937' : '#f9fafb', 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem', 
              padding: '1.25rem'
            }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Database Specifications
              </h4>
              
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Embedding Model</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewVectorCollection?.embeddingModel}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Vector Dimensions</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewVectorCollection?.vectorDimension}
                </span>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Linked Context Profiles</span>
                <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827', fontWeight: 500 }}>
                  {viewVectorCollection?.profiles?.length || 0} active integrations
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
              <div>Created: {viewVectorCollection?.createdAt ? new Date(viewVectorCollection.createdAt).toLocaleString() : ''}</div>
              {viewVectorCollection?.updatedAt && <div>Last Updated: {new Date(viewVectorCollection.updatedAt).toLocaleString()}</div>}
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>Indexed Documents</h4>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Files currently processed and available for RAG retrieval.
              </p>
            </div>

            <div style={{ 
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, 
              borderRadius: '0.5rem', 
              overflow: 'hidden',
              flexGrow: 1
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>File Name</th>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>Size</th>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!viewVectorCollection?.documents || viewVectorCollection.documents.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '3rem 1rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                        No documents are currently indexed in this collection.
                      </td>
                    </tr>
                  ) : (
                    viewVectorCollection.documents.map(doc => (
                      <tr key={doc.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                        <td style={{ padding: '0.75rem 1rem', color: darkMode ? '#f9fafb' : '#111827' }}>{doc.name || doc.textContent?.slice(0,20)}</td>
                        <td style={{ padding: '0.75rem 1rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{doc.size || 'Unknown'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ 
                            padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', 
                            backgroundColor: doc.status === 'Indexed' ? (darkMode ? '#064e3b' : '#dcfce7') : (darkMode ? '#713f12' : '#fef08a'),
                            color: doc.status === 'Indexed' ? (darkMode ? '#34d399' : '#166534') : (darkMode ? '#fde047' : '#854d0e')
                          }}>
                            {doc.status || 'Indexed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </ExtraLargeModal>

      <ExtraLargeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Vector Collection"
        darkMode={darkMode}
        
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="input-typography"
              style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#555' : '#ccc'}`, color: darkMode ? '#fff' : '#000', borderRadius: '4px' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleCreateSubmit}
              disabled={!isCollectionValid}
              className="input-typography"
              style={{ 
                padding: '0.75rem 1.5rem', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                cursor: isCollectionValid ? 'pointer' : 'not-allowed',
                opacity: isCollectionValid ? 1 : 0.5
              }}
            >
              Create Collection
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflowX: 'hidden' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Collection Name <span style={{ color: 'red' }}>*</span></label>
              <input 
                type="text" 
                name="name"
                value={newCollectionData.name}
                onChange={handleCreateInputChange}
                className="input-typography"
                placeholder="e.g., HR Documents 2026"
                style={{
                  ...inputStyle,
                  borderColor: isNameDuplicate ? '#ef4444' : (darkMode ? '#374151' : '#d1d5db')
                }}
              />
              {isNameDuplicate && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                  A collection with this name already exists.
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Description</label>
              <textarea 
                name="description"
                value={newCollectionData.description || ''}
                className="input-typography"
                onChange={handleCreateInputChange}
                placeholder="Briefly describe the contents of this vector collection..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0, overflowX: 'hidden' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Embedding Model <span style={{ color: 'red' }}>*</span></label>
              <select 
                name="embeddingModel"
                className="input-typography"
                value={newCollectionData.embeddingModel || ''}
                onChange={handleCreateInputChange}
                style={inputStyle}
              >
                <option value="" disabled>Select an Embedding Model...</option>
                {foundationModels.map((model) => (
                  <option key={model.apiIdentifier} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Vector Dimension</label>
              <input 
                type="number" 
                name="vectorDimension"
                className="input-typography"
                value={newCollectionData.vectorDimension}
                onChange={handleCreateInputChange}
                style={inputStyle}
              />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: darkMode ? '#999' : '#666' }}>
                Ensure this matches the output dimension of your selected embedding model.
              </p>
            </div>
          </div>

        </div>
      </ExtraLargeModal>

      <FullScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editVectorCollection ? `Manage Vector Collection: ${editVectorCollection.name}` : 'Edit Collection'}
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
              Save Changes
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', height: '100%' }}>
          
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
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Collection Name</label>
              <input 
                type="text" 
                name="name"
                value={editVectorCollectionData.name || ''}
                onChange={handleEditInputChange}
                className="input-typography"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Description</label>
              <textarea 
                name="description"
                value={ editVectorCollectionData.description || '' }
                onChange={handleEditInputChange}
                className="input-typography"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Embedding Model <span style={{ color: 'red' }}>*</span></label>
              <select 
                name="embeddingModel"
                className="input-typography"
                value={editVectorCollectionData.embeddingModel || ''}
                onChange={handleEditInputChange}
                style={inputStyle}
              >
                <option value="" disabled>Select an Embedding Model...</option>
                {foundationModels.map((model) => (
                  <option key={model.apiIdentifier} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: darkMode ? '#ccc' : '#333' }}>Vector Dimension</label>
              <input 
                type="number" 
                name="vectorDimension"
                className="input-typography"
                value={editVectorCollectionData.vectorDimension || ''}
                onChange={handleEditInputChange}
                style={inputStyle}
              />
            </div>
            {editVectorCollection && (
              <div style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: darkMode ? '#f9fafb' : '#111827' }}>Database Specs</h4>
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Current Model</span>
                  <span style={{ fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>{editVectorCollection.embeddingModel}</span>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', paddingTop: '1rem', paddingBottom: '1rem' }}>
              <div>Created: {editVectorCollection?.createdAt ? new Date(editVectorCollection.createdAt).toLocaleString() : ''}</div>
              {editVectorCollection?.updatedAt && <div>Last Updated: {new Date(editVectorCollection.updatedAt).toLocaleString()}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, color: darkMode ? '#f9fafb' : '#111827' }}>Data Sources</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Manage indexed documents.</p>
              </div>
              
              <div>
                <input type="file" ref={hiddenDirectS3Input} style={{ display: 'none' }} onChange={handleDirectS3Upload} />
                <button 
                  onClick={() => hiddenDirectS3Input.current?.click()}
                  className="input-typography"
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
                  title="Upload directly to AWS S3 storage."
                >
                  Upload Vector Document
                </button>
              </div>
            </div>

            <div style={{ border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', overflowY: 'auto', flexGrow: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>File Name</th>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>Size</th>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vectorDocuments.length === 0 ? (
                    <tr>
                      <td 
                        colSpan={4} 
                        style={{ 
                          padding: '3rem 1rem', 
                          textAlign: 'center', 
                          color: darkMode ? '#9ca3af' : '#6b7280',
                          fontSize: '0.875rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '2rem', height: '2rem', opacity: 0.5 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          <span>No documents uploaded yet.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    vectorDocuments.map(doc => (
                      <tr key={doc.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                        <td style={{ padding: '0.75rem 1rem', color: darkMode ? '#f9fafb' : '#111827' }}>{doc.name || doc.textContent?.slice(0, 20)}</td>
                        <td style={{ padding: '0.75rem 1rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{doc.size || 'Unknown'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ 
                            padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', 
                            backgroundColor: doc.status === 'Indexed' ? (darkMode ? '#064e3b' : '#dcfce7') : (darkMode ? '#713f12' : '#fef08a'),
                            color: doc.status === 'Indexed' ? (darkMode ? '#34d399' : '#166534') : (darkMode ? '#fde047' : '#854d0e')
                          }}>
                            {doc.status || 'Indexed'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button className="input-typography" style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </FullScreenModal>

      <BottomRightModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        icon={<i className="bx bx-trash" />}
        title="Delete Vector Collection"
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
              onClick={handleDeleteVectorCollection}
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
            Deleting Vector Collection: <strong>{deleteVectorCollection?.name}</strong> from database records. 
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
  );
};

export default VectorCollectionsUI;