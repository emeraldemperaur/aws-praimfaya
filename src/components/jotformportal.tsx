export const JotformEmbed = ({ formId, darkMode }: { formId: string, darkMode: boolean }) => (
  <div style={{ margin: '1rem 0', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: darkMode ? '#1f2937' : '#fff' }}>
    <div style={{ backgroundColor: darkMode ? '#111827' : '#f3f4f6', padding: '0.5rem 1rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: darkMode ? '#d1d5db' : '#374151' }}>Jotform Preview</span>
      <a href={`https://form.jotform.com/${formId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: darkMode ? '#60a5fa' : '#2563eb', textDecoration: 'none' }}>
        Open in New Tab ↗
      </a>
    </div>
    <iframe
      id={`JotFormIFrame-${formId}`}
      title="Vanguard Generated Form"
      allowTransparency={true}
      allow="geolocation; microphone; camera; fullscreen"
      src={`https://form.jotform.com/${formId}`}
      frameBorder="0"
      style={{ minWidth: '100%', height: '500px', border: 'none' }}
      scrolling="yes"
    />
  </div>
);