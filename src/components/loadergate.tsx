import { useEffect, useState } from 'react';
import '../styles/loadergate.scss';

const LoaderGate = ({ children, darkMode = false }: { children: React.ReactNode, darkMode?: boolean }) => {
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1696);

        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className={`cl-box ${darkMode ? 'dark-mode' : 'light-mode'}`}>
                <div className="cl-container">
                    <div className="upper">Praimfaya</div>
                    <div className="lower">Praimfaya</div>
                    <div className="inside">Loading...</div>
                </div>
            </div>
        )
    }
    
    return <>{children}</>;
}

export default LoaderGate;