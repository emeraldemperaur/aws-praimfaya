import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getUrl } from 'aws-amplify/storage';

const RAGArtifactsUI = ({ darkMode = false }: { darkMode?: boolean }) => {
  const client = generateClient() as any;
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    const fetchArtifacts = async () => {
      try {
        const { data } = await client.models.RAGArtifact.list();
        
        const artifactsWithSecureUrls = await Promise.all(
          data.map(async (art: any) => {
            try {
              const signedUrlResponse = await getUrl({ 
                path: art.s3Key 
              });
              
              return { 
                ...art, 
                freshUrl: signedUrlResponse.url.toString() 
              };
            } catch (urlErr) {
              console.error(`Failed to generate secure link for ${art.s3Key}:`, urlErr);
              return { ...art, freshUrl: '' };
            }
          })
        );

        setArtifacts(artifactsWithSecureUrls.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } catch (err) {
        console.error("Failed to fetch RAG artifacts:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtifacts();
  }, []);

  const filteredArtifacts = artifacts.filter(art => {
    const matchesType = typeFilter === 'ALL' || art.fileType === typeFilter;
    const matchesSearch = (art.fileName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (art.terminalTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (art.contextProfileName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getIconForType = (type: string) => {
    if (type === 'IMAGE') return 'fa-image';
    if (type === 'VIDEO') return 'fa-video';
    if (type === 'AUDIO') return 'fa-file-audio';
    return 'fa-file-lines';
  };

  return (
    <div style={{ 
      padding: '2rem', 
      marginTop: '7.3rem', 
      minHeight: 'calc(100vh - 7.3rem)', 
      backgroundColor: darkMode ? '#111827' : '#f9fafb',
      color: darkMode ? '#f9fafb' : '#111827',
      fontFamily: 'Google Sans Code, monospace'
    }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '2rem' }}>RAG Artifacts</h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            Generated media, documents, and assets across all Vanguard Terminal sessions.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search filenames, sessions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.85rem', width: '250px',
              backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
              color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'inherit'
            }}
          />
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.85rem',
              backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
              color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'inherit'
            }}
          >
            <option value="ALL">All Formats</option>
            <option value="IMAGE">Images</option>
            <option value="AUDIO">Audio</option>
            <option value="VIDEO">Video</option>
            <option value="DOCUMENT">Documents</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>Loading artifacts...</div>
      ) : filteredArtifacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>No artifacts found matching your criteria.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredArtifacts.map((art) => (
            <div key={art.id} style={{
              backgroundColor: darkMode ? '#1f2937' : '#ffffff',
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              
              <div style={{ height: '180px', backgroundColor: darkMode ? '#111827' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, position: 'relative' }}>
                <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                  <i className={`fa-solid ${getIconForType(art.fileType)}`}></i> {art.fileType}
                </span>

                {art.fileType === 'IMAGE' && <img src={art.freshUrl} alt={art.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />}
                {art.fileType === 'VIDEO' && <video src={art.freshUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />}
                {art.fileType === 'AUDIO' && <div style={{ width: '80%' }}><audio src={art.freshUrl} controls style={{ width: '100%' }} /></div>}
                {art.fileType === 'DOCUMENT' && <i className="fa-solid fa-file-pdf" style={{ fontSize: '3rem', color: darkMode ? '#4b5563' : '#9ca3af' }}></i>}
              </div>

              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={art.fileName}>
                  {art.fileName}
                </h3>
                
                <div style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
                  <span><strong>Session:</strong> {art.terminalTitle || 'Terminal Chat'}</span>
                  <span><strong>Profile:</strong> {art.contextProfileName}</span>
                  <span><strong>Date:</strong> {new Date(art.createdAt).toLocaleDateString()}</span>
                </div>

                <a 
                  href={art.freshUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    marginTop: 'auto', textAlign: 'center', padding: '0.5rem', backgroundColor: '#800020', color: 'white', 
                    borderRadius: '4px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase'
                  }}
                >
                  Open Artifact <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RAGArtifactsUI;