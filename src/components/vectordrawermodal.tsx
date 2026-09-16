import DrawerModal from './drawermodal';
import type { DeepTerminalSession } from '../pages/terminalsession';
import type { Schema } from '../../amplify/data/resource'; 

interface VectorDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode?: boolean;
  session: DeepTerminalSession | null;
}

export const VectorDrawerModal = ({ isOpen, onClose, darkMode = false, session }: VectorDrawerModalProps) => {
  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DrawerModal
      isOpen={isOpen}
      onClose={onClose}
      icon={<i className="fa-regular fa-hard-drive"></i>}
      title="Knowledge Base Collection"
      darkMode={darkMode}
      width="650px"
      height="100vh"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', paddingRight: '0.5rem' }}>
        
        {session?.contextProfile?.vectorCollection ? (
          <>
            <div style={{ padding: '1.25rem', borderRadius: '8px', backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>{session.contextProfile.vectorCollection.name}</h4>
              <p style={{ margin: 0, color: darkMode ? '#d1d5db' : '#4b5563', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {session.contextProfile.vectorCollection.description || 'No description provided.'}
              </p>
              <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                Engine: <strong style={{ color: darkMode ? '#f9fafb' : '#111827' }}>{session.contextProfile.vectorCollection.embeddingModel}</strong>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 1rem 0', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1rem' }}>Indexed Documents</h4>
              <div style={{ border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.5rem', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                    <tr>
                      <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>File Name</th>
                      <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600 }}>Size</th>
                      <th style={{ padding: '0.75rem', color: darkMode ? '#d1d5db' : '#374151', fontWeight: 600, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!session.contextProfile.vectorCollection.documents || session.contextProfile.vectorCollection.documents.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>No documents in this collection.</td>
                      </tr>
                    ) : (
                      session.contextProfile.vectorCollection.documents.map((doc: Schema['VectorDocument']['type'] | null) => (
                        <tr key={doc?.id} style={{ borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                          <td style={{ padding: '0.75rem', color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Google Sans Code, monospace', fontSize: '0.75rem' }}>
                            <span style={{ display: 'block', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc?.name || 'unknown'}>
                              {doc?.name || 'unknown'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '0.75rem' }}>
                             {doc?.size || 'N/A'}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            {doc?.s3Uri ? (
                              <button 
                                onClick={() => downloadFile(doc.s3Uri as string, doc.name || 'document')}
                                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                              >
                                Download <i className="fa-solid fa-download"></i>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: darkMode ? '#6b7280' : '#9ca3af' }}>No URI</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', height: '100%', padding: '2rem', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
             <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
               <path d="m21.45 6.11-6-3c-.26-.13-.56-.14-.83-.03l-12 5C2.25 8.24 2 8.6 2 9v8c0 .38.21.73.55.89l6 3c.14.07.29.11.45.11.13 0 .26-.03.38-.08l12-5c.37-.16.62-.52.62-.92V7c0-.38-.21-.73-.55-.89M14.96 5.1l3.64 1.82-9.56 3.98L5.4 9.08zM10 12.67l2-.83v5.83l-2 .83zM14 11l2-.83V16l-2 .83zm-10-.38 4 2v5.76l-4-2zm14 4.55V9.34l2-.83v5.83z"></path>
             </svg>
             <span>{session?.contextProfile?.name} does not have a linked Vector Collection.</span>
           </div>
        )}
      </div>
    </DrawerModal>
  );
};