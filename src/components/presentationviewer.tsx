import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface SlideTask {
    slideIndex: number;
    bedrockInvocationArn: string;
    s3ExpectedOutput: string;
    overlayText: string;
    speakerScript?: string;
}

interface LumaPresentationViewerProps {
    pipeline: {
        theme: string;
        tasks: SlideTask[];
    };
    darkMode: boolean;
}

const LumaPresentationViewer: React.FC<LumaPresentationViewerProps> = ({ pipeline, darkMode }) => {
    const [slideStatuses, setSlideStatuses] = useState<Record<number, string>>({});
    const [activeSlide, setActiveSlide] = useState(0);

    useEffect(() => {
        const activePolls = new Set(pipeline.tasks.map(t => t.slideIndex));
        
        const pollInterval = setInterval(async () => {
            if (activePolls.size === 0) {
                clearInterval(pollInterval);
                return;
            }

            for (const task of pipeline.tasks) {
                if (slideStatuses[task.slideIndex] === 'Completed') {
                    activePolls.delete(task.slideIndex);
                    continue;
                }

                try {
                    const res = await client.queries.pollBedrockAsyncJob({ 
                        invocationArn: task.bedrockInvocationArn 
                    });
                    
                    const parsed = JSON.parse(res.data || '{}');
                    setSlideStatuses(prev => ({
                        ...prev,
                        [task.slideIndex]: parsed.status
                    }));

                } catch (err) {
                    console.error(`Failed to poll slide ${task.slideIndex}`, err);
                }
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(pollInterval);
    }, [pipeline]);

    const currentTask = pipeline.tasks[activeSlide];
    const isCompleted = slideStatuses[currentTask.slideIndex] === 'Completed';

    return (
        <div style={{
            backgroundColor: darkMode ? '#111827' : '#ffffff',
            borderRadius: '0.75rem',
            border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
            overflow: 'hidden',
            width: '100%',
            maxWidth: '800px',
            margin: '1rem 0'
        }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000' }}>
                {isCompleted ? (
                    <video 
                        src={currentTask.s3ExpectedOutput} 
                        autoPlay 
                        loop 
                        muted 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#0ea5e9', marginBottom: '1rem' }}></i>
                        <span>Rendering Cinematic Scene {currentTask.slideIndex}...</span>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>Amazon Bedrock Luma Ray-2</span>
                    </div>
                )}

                {isCompleted && (
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '3rem',
                        background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 100%)',
                        color: '#ffffff',
                        textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, lineHeight: 1.2, textAlign: 'left', width: '100%' }}>
                            {currentTask.overlayText}
                        </h2>
                    </div>
                )}
            </div>

            <div style={{ padding: '1rem', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button 
                        onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
                        disabled={activeSlide === 0}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px', border: 'none', backgroundColor: '#374151', color: '#fff' }}
                    >
                        Previous
                    </button>
                    <span style={{ color: darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.875rem' }}>
                        Slide {activeSlide + 1} of {pipeline.tasks.length}
                    </span>
                    <button 
                        onClick={() => setActiveSlide(Math.min(pipeline.tasks.length - 1, activeSlide + 1))}
                        disabled={activeSlide === pipeline.tasks.length - 1}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px', border: 'none', backgroundColor: '#0ea5e9', color: '#fff' }}
                    >
                        Next
                    </button>
                </div>
                
                {currentTask.speakerScript && (
                    <div style={{ padding: '0.75rem', backgroundColor: darkMode ? '#1f2937' : '#f3f4f6', borderRadius: '4px' }}>
                        <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: darkMode ? '#9ca3af' : '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                            Speaker Notes
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151', lineHeight: 1.5 }}>
                            {currentTask.speakerScript}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LumaPresentationViewer;