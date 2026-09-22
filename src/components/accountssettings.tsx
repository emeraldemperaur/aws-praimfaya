import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import DataTable, { type ColumnDef } from '../components/datatable';
import SearchRibbon from '../components/searchribbon';
import ExtraLargeModal from '../components/extralargemodal';
import { TIMEZONES } from '../utils/chronos'; // Enterprise Dictionary Import
import { NATIVE_TOOLS_TEMPLATES } from '../utils/prometheus';

const client = generateClient<Schema>();

interface AccountsSettingsProps {
    searchQuery: string; 
    darkMode?: boolean;
}

type UserProfile = Schema['UserProfile']['type'];

interface ModalState {
    isOpen: boolean;
    type: 'MANAGE' | 'CREDIT' | 'STATUS' | null;
    user: UserProfile | null;
}

const AccountsSettings: React.FC<AccountsSettingsProps> = ({ searchQuery, darkMode = false }) => {
    // --- Data & Filtering State ---
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ribbonSearch, setRibbonSearch] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('ALL');

    // --- Modal & Action State ---
    const [modal, setModal] = useState<ModalState>({ isOpen: false, type: null, user: null });
    const [isMutating, setIsMutating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- Lazy Loaded Metrics ---
    const [activeUserMetrics, setActiveUserMetrics] = useState({ activityCount: 0, integrationsCount: 0, isLoading: false });

    // --- Form States for Modals ---
    const [creditAmount, setCreditAmount] = useState<number | ''>('');
    const [creditAction, setCreditAction] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
    const [roleSelection, setRoleSelection] = useState<string>('standard');

    // --- 1. BULLETPROOF PAGINATION & COST CONTROL ---
    const fetchUsers = async (showRefreshState = false) => {
        if (showRefreshState) setIsRefreshing(true);
        else setIsLoading(true);
        
        try {
            let allFetchedUsers: UserProfile[] = [];
            let token: string | undefined = undefined;
            let isFetching = true;
            
            const MAX_RECORDS_SYNC = 5000; 

            while (isFetching) {
                const listResponse: { data: UserProfile[]; nextToken?: string | null | undefined } = await client.models.UserProfile.list({ 
                    limit: 1000, 
                    ...(token ? { nextToken: token } : {})
                });
                
                allFetchedUsers = [...allFetchedUsers, ...listResponse.data];
                
                if (listResponse.nextToken && allFetchedUsers.length < MAX_RECORDS_SYNC) {
                    token = listResponse.nextToken;
                } else {
                    isFetching = false;
                }
            }

            setUsers(allFetchedUsers);
        } catch (err) {
            console.error("[Vanguard] Failed to sync UserProfile ledger:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // --- 2. MEMOIZED DUAL-FILTERING ---
    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const globalMatch = !searchQuery || 
                user.cognitoUserId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase()));

            let ribbonMatch = true;
            if (ribbonSearch && selectedFilter !== 'ALL') {
                const val = user[selectedFilter as keyof UserProfile];
                ribbonMatch = val ? String(val).toLowerCase().includes(ribbonSearch.toLowerCase()) : false;
            } else if (ribbonSearch && selectedFilter === 'ALL') {
                ribbonMatch = JSON.stringify(user).toLowerCase().includes(ribbonSearch.toLowerCase());
            }

            return globalMatch && ribbonMatch;
        });
    }, [users, searchQuery, ribbonSearch, selectedFilter]);

    // --- 3. LAZY-LOADED METRICS (Cost Efficient) ---
    useEffect(() => {
        let isMounted = true;
        
        if (modal.isOpen && modal.type === 'MANAGE' && modal.user) {
            setActiveUserMetrics({ activityCount: 0, integrationsCount: 0, isLoading: true });
            const currentUserId = modal.user.cognitoUserId;
            
            let iCount = 0;
            if (modal.user.integrations) {
                try {
                    const parsed = typeof modal.user.integrations === 'string' ? JSON.parse(modal.user.integrations) : modal.user.integrations;
                    iCount = Object.keys(parsed).length;
                } catch { iCount = 0; }
            }

            const fetchActivityCount = async () => {
                try {
                    const response: { data: any[] } = await client.models.AgentActivity.list({
                        filter: { userId: { eq: currentUserId } },
                        limit: 500,
                        selectionSet: ['id'] as any 
                    });
                    
                    if (isMounted && modal.user?.cognitoUserId === currentUserId) {
                        setActiveUserMetrics({
                            activityCount: response.data.length,
                            integrationsCount: iCount,
                            isLoading: false
                        });
                    }
                } catch (error) {
                    console.error("[Vanguard] Failed to fetch activity metrics:", error);
                    if (isMounted) setActiveUserMetrics(prev => ({ ...prev, isLoading: false }));
                }
            };

            fetchActivityCount();
        }
        
        return () => { isMounted = false; };
    }, [modal.isOpen, modal.type, modal.user]);

    const integrationTooltip = useMemo(() => {
        if (!modal.user?.integrations) return "No active integrations";
        try {
            const parsed = typeof modal.user.integrations === 'string' 
                ? JSON.parse(modal.user.integrations) 
                : modal.user.integrations;
            
            const activeToolKeys = Object.keys(parsed);
            
            if (activeToolKeys.length === 0) return "No active integrations";

            const names = activeToolKeys.map(toolKey => {
                const template = NATIVE_TOOLS_TEMPLATES.find(t => t.toolName === toolKey);
                return template ? template.publicName : toolKey;
            });

            return names.join('\n');
        } catch (error) {
            console.error("[Vanguard] Failed to parse integration tooltip", error);
            return "Failed to parse integrations";
        }
    }, [modal.user?.integrations]);

    // --- 4. SECURE MUTATION HANDLERS ---
    const handleToggleAttribute = async (attribute: 'mcpDiscovery' | 'nocturnalAgents') => {
        if (!modal.user) return;
        const newValue = !modal.user[attribute];
        
        setModal(prev => prev.user ? { ...prev, user: { ...prev.user, [attribute]: newValue } } : prev);
        
        try {
            await client.models.UserProfile.update({
                id: modal.user.id,
                [attribute]: newValue
            });
        } catch (err) {
            console.error(`[Vanguard] Failed to update ${attribute}`, err);
            setModal(prev => prev.user ? { ...prev, user: { ...prev.user, [attribute]: !newValue } } : prev);
        }
    };

    const submitCreditUpdate = async () => {
        if (!modal.user || !creditAmount || Number(creditAmount) <= 0) return;
        setIsMutating(true);
        try {
            if (creditAction === 'CREDIT') {
                await client.mutations.grantPromoCredits({
                    targetCognitoUserId: modal.user.cognitoUserId, 
                    creditAmount: Number(creditAmount)
                });
            } else {
                const newTotal = Math.max(0, (modal.user.computeCredits || 0) - Number(creditAmount));
                await client.models.UserProfile.update({
                    id: modal.user.id,
                    computeCredits: newTotal
                });
            }
            
            setUsers(prev => prev.map(u => u.id === modal.user!.id ? { 
                ...u, 
                computeCredits: creditAction === 'CREDIT' 
                    ? (u.computeCredits || 0) + Number(creditAmount) 
                    : Math.max(0, (u.computeCredits || 0) - Number(creditAmount)) 
            } : u));
            closeModal();
        } catch (err) {
            console.error("[Vanguard] Credit transaction failed", err);
            alert("Transaction failed. Please check IAM permissions or AWS logs.");
        } finally {
            setIsMutating(false);
        }
    };

    const submitStatusUpdate = async () => {
        if (!modal.user) return;
        setIsMutating(true);
        const newStatus = modal.user.subscriptionStatus === 'ACTIVE' ? 'CANCELED' : 'ACTIVE';
        try {
            await client.models.UserProfile.update({
                id: modal.user.id,
                subscriptionStatus: newStatus
            });
            
            setUsers(prev => prev.map(u => u.id === modal.user!.id ? { ...u, subscriptionStatus: newStatus } : u));
            closeModal();
        } catch (err) {
            console.error("[Vanguard] Status update failed", err);
            alert("Failed to update status. Please check connection.");
        } finally {
            setIsMutating(false);
        }
    };

    const submitRoleUpdate = async () => {
        if (!modal.user) return;
        setIsMutating(true);
        try {
            await client.mutations.updateUserGroup({
                targetCognitoUserId: modal.user.cognitoUserId,
                groupName: roleSelection
            });
            alert(`Successfully updated identity group to: ${roleSelection.toUpperCase()}`);
        } catch (err) {
            console.error("[Vanguard] Failed to update role:", err);
            alert("Failed to update Identity Group. Ensure you have Superadmin permissions.");
        } finally {
            setIsMutating(false);
        }
    };

    const closeModal = () => {
        setModal({ isOpen: false, type: null, user: null });
        setCreditAmount('');
        setCreditAction('CREDIT');
    };

    // --- 5. DATATABLE CONFIG ---
    const columns: ColumnDef<UserProfile>[] = [
        { header: 'User ID', accessor: 'cognitoUserId', sortable: true, width: '25%', render: (row) => <code onClick={() => setModal({ isOpen: true, type: 'MANAGE', user: row })} 
        style={{cursor: 'pointer', fontFamily: 'Google Sans Code', fontSize: '0.88rem', backgroundColor: darkMode ? '#374151' : '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '4px', whiteSpace: 'normal', wordBreak: 'break-all', display: 'inline-block', lineHeight: '1.2' }}>{row.cognitoUserId}</code> },
        { header: 'Name', accessor: 'lastName', sortable: true, width: '20%', render: (row) => <span style={{ fontWeight: 600, fontFamily: 'Bodoni Moda Variable'}}>{[row.firstName, row.lastName].filter(Boolean).join(' ') || 'Not Specified'}</span> },
        { header: 'Plan', accessor: 'planName', sortable: true, width: '15%', render: (row) => (
            <span style={{ fontFamily: 'Bodoni Moda Variable', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: row.planName === 'VANGUARD_ELITE' ? '#80002020' : darkMode ? '#374151' : '#e5e7eb', color: row.planName === 'VANGUARD_ELITE' ? '#800020' : 'inherit', fontWeight: 700 }}>
                {row.planName?.replace('_', ' ') || 'NONE'}
            </span>
        )},
        { header: 'Credits', accessor: 'computeCredits', sortable: true, width: '15%', render: (row) => <span style={{ fontFamily: 'Google Sans Code', fontWeight: 600, color: (row.computeCredits || 0) < 1000 ? '#ef4444' : '#10b981' }}>{(row.computeCredits || 0).toLocaleString()}</span> },
        { header: 'Status', accessor: 'subscriptionStatus', sortable: true, width: '10%', render: (row) => (
            <span style={{fontFamily: 'Bodoni Moda Variable', fontSize: '0.7rem', textTransform: 'uppercase', color: row.subscriptionStatus === 'ACTIVE' ? '#10b981' : '#ef4444' }}>
                <i className={`fa-solid ${row.subscriptionStatus === 'ACTIVE' ? 'fa-check-circle' : 'fa-ban'}`} style={{ marginRight: '4px' }}></i>
                {row.subscriptionStatus}
            </span>
        )},
        { header: 'Actions', accessor: 'actions', sortable: false, width: '15%', render: (row) => (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setModal({ isOpen: true, type: 'MANAGE', user: row })} title="Manage Settings" style={btnStyle(darkMode, 'neutral')}><i className="bx bx-slider-alt"></i></button>
                <button onClick={() => setModal({ isOpen: true, type: 'CREDIT', user: row })} title="Manage Credits" style={btnStyle(darkMode, 'success')}><i className="bx bx-dollar"></i></button>
                <button onClick={() => setModal({ isOpen: true, type: 'STATUS', user: row })} title={row.subscriptionStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'} style={btnStyle(darkMode, row.subscriptionStatus === 'ACTIVE' ? 'danger' : 'success')}><i className="bx bx-power-off"></i></button>
            </div>
        )}
    ];

    const filterOptions = [
        { label: 'All Fields', value: 'ALL' },
        { label: 'User ID', value: 'cognitoUserId' },
        { label: 'Stripe ID', value: 'stripeCustomerId' },
        { label: 'Plan Name', value: 'planName' },
        { label: 'Time Zone', value: 'timeZone' }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'Google Sans Code, monospace' }}>
            
            <style>
                {`
                    .hitl-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
                    .hitl-switch input { opacity: 0; width: 0; height: 0; }
                    .hitl-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${darkMode ? '#4b5563' : '#ccc'}; transition: .3s; border-radius: 34px; }
                    .hitl-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
                    .hitl-switch input:checked + .hitl-slider { background-color: ${darkMode ? '#ffffff' : '#0B0B45'}; }
                    .hitl-switch input:checked + .hitl-slider:before { transform: translateX(20px); background-color: ${darkMode ? '#0B0B45' : '#ffffff'}; }
                `}
            </style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SearchRibbon
                    darkMode={darkMode}
                    recordCount={filteredUsers.length}
                    recordLabel="User Profiles"
                    searchTerm={ribbonSearch}
                    onSearchChange={setRibbonSearch}
                    selectedFilter={selectedFilter}
                    onFilterChange={setSelectedFilter}
                    filterOptions={filterOptions}
                />
                
                <button 
                    onClick={() => fetchUsers(true)}
                    disabled={isRefreshing}
                    style={{ 
                        alignSelf: 'flex-start',
                        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1rem', borderRadius: '6px', 
                        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, background: darkMode ? '#1f2937' : '#fff', 
                        color: darkMode ? '#f9fafb' : '#111827', cursor: isRefreshing ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                        opacity: isRefreshing ? 0.5 : 1
                    }}
                >
                    <i className={`bx bx-refresh ${isRefreshing ? 'bx-spin' : ''}`}></i>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.13em' }}>
                        Sync Ledger
                    </span>
                </button>
            </div>

            <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <DataTable
                    columns={columns}
                    data={filteredUsers}
                    darkMode={darkMode}
                    isLoading={isLoading}
                    pagination={true}
                    defaultPageSize={10}
                    pageSizeOptions={[10, 25, 50, 100]}
                />
            </div>

            {modal.type === 'MANAGE' && modal.user && createPortal(
                <ExtraLargeModal
                    isOpen={modal.isOpen}
                    onClose={closeModal}
                    title={`Manage User: ${[modal.user.firstName, modal.user.lastName].filter(Boolean).join(' ') || modal.user.cognitoUserId}`}
                    darkMode={darkMode}
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <button onClick={closeModal} style={{ background: '#800020', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.13rem', fontFamily: 'Bodoni Moda Variable' }}>Done</button>
                        </div>
                    }
                >
                    {/* FIX: Applied maxHeight and overflowY to safely scroll overflow content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div style={infoCard(darkMode)}>
                                <span style={infoLabel(darkMode)}>Cognito User ID</span>
                                <code style={{ fontSize: '0.8rem', color: '#3b82f6' }}>{modal.user.cognitoUserId}</code>
                            </div>
                            <div style={infoCard(darkMode)}>
                                <span style={infoLabel(darkMode)}>Stripe Customer ID</span>
                                <code style={{ fontSize: '0.8rem', color: '#10b981' }}>{modal.user.stripeCustomerId || 'N/A'}</code>
                            </div>
                            <div style={infoCard(darkMode)}>
                                <span style={infoLabel(darkMode)}>Billing Cycle End</span>
                                <strong style={{ fontSize: '0.9rem' }}>{modal.user.currentPeriodEnd ? new Date(modal.user.currentPeriodEnd).toLocaleDateString() : 'N/A'}</strong>
                            </div>
                            <div style={infoCard(darkMode)}>
                                <span style={infoLabel(darkMode)}>Time Zone</span>
                                {/* FIX: Maps tzIdentifier to readable string from TIMEZONES dictionary */}
                                <strong style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={TIMEZONES.find(tz => tz.tzIdentifier === modal.user?.timeZone)?.label || modal.user.timeZone || 'UTC'}>
                                    {TIMEZONES.find(tz => tz.tzIdentifier === modal.user?.timeZone)?.label || modal.user.timeZone || 'UTC'}
                                </strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {/* FIX: Appended native title attribute for integration tooltip details and info icon */}
                            <div style={{ ...infoCard(darkMode), flex: 1, backgroundColor: darkMode ? '#3730a320' : '#e0e7ff50', border: `1px solid ${darkMode ? '#3730a3' : '#c7d2fe'}`, position: 'relative' }} title={integrationTooltip}>
                                <span style={{ ...infoLabel(darkMode), display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    Connected Integrations
                                    <i className="bx bx-info-circle" style={{ cursor: 'help', fontSize: '0.85rem' }}></i>
                                </span>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Bodoni Moda Variable' }}>
                                    {activeUserMetrics.isLoading ? <i className="bx bx-loader-alt bx-spin"></i> : activeUserMetrics.integrationsCount}
                                </div>
                            </div>
                            <div style={{ ...infoCard(darkMode), flex: 1, backgroundColor: darkMode ? '#065f4620' : '#dcfce750', border: `1px solid ${darkMode ? '#065f46' : '#bbf7d0'}` }}>
                                <span style={infoLabel(darkMode)}>Agentic Actions Executed</span>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Bodoni Moda Variable' }}>
                                    {activeUserMetrics.isLoading ? <i className="bx bx-loader-alt bx-spin"></i> : `${activeUserMetrics.activityCount}${activeUserMetrics.activityCount === 500 ? '+' : ''}`}
                                </div>
                            </div>
                        </div>

                        <div style={{ borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.1rem' }}>Access & Role Assignment</h4>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <select 
                                    value={roleSelection} 
                                    onChange={(e) => setRoleSelection(e.target.value)}
                                    style={{ fontFamily: 'Google Sans Code', padding: '0.5rem 1rem', borderRadius: '4px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, background: darkMode ? '#1f2937' : '#fff', color: darkMode ? '#f9fafb' : '#111827', outline: 'none' }}
                                >
                                    <option value="standard">Standard User</option>
                                    <option value="admin">Admin</option>
                                    <option value="heda">HEDA / Read-Only Admin</option>
                                    <option value="superadmin">Superadmin</option>
                                    <option value="root">Root Authority</option>
                                </select>
                                <button 
                                    onClick={submitRoleUpdate} 
                                    disabled={isMutating}
                                    style={{ fontFamily: 'Bodoni Moda Variable', padding: '0.5rem 1rem', background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                                        color: darkMode ? '#d1d5db' : '#4b5563', borderRadius: '4px', cursor: isMutating ? 'not-allowed' : 'pointer', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isMutating ? 0.5 : 1 }}
                                >
                                    {isMutating ? <i className="bx bx-loader-alt bx-spin"></i> : null}
                                    {isMutating ? 'Updating...' : 'Update Identity Group'}
                                </button>
                            </div>
                        </div>

                        <div style={{ borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.1rem' }}>Platform Feature Flags</h4>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: darkMode ? '#111827' : '#f9fafb', padding: '1rem', borderRadius: '8px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                                <div>
                                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Enable MCP Discovery</strong>
                                    <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', fontFamily: 'Google Sans Code' }}>Allow remote MCP to access account context resources.</span>
                                </div>
                                <label className="hitl-switch">
                                    <input type="checkbox" checked={modal.user.mcpDiscovery || false} onChange={() => handleToggleAttribute('mcpDiscovery')} />
                                    <span className="hitl-slider"></span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: darkMode ? '#111827' : '#f9fafb', padding: '1rem', borderRadius: '8px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                                <div>
                                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Enable Nocturnal Agents</strong>
                                    <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', fontFamily: 'Google Sans Code' }}>Allow agents to execute tools or workflows off-hours.</span>
                                </div>
                                <label className="hitl-switch">
                                    <input type="checkbox" checked={modal.user.nocturnalAgents || false} onChange={() => handleToggleAttribute('nocturnalAgents')} />
                                    <span className="hitl-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </ExtraLargeModal>, document.body
            )}

            {modal.type === 'CREDIT' && modal.user && createPortal(
                <ExtraLargeModal
                    isOpen={modal.isOpen}
                    onClose={closeModal}
                    title="Compute Credit Adjustment"
                    darkMode={darkMode}
                    footer={
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
                            <button onClick={closeModal} disabled={isMutating} style={{ background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#d1d5db' : '#4b5563', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={submitCreditUpdate} disabled={isMutating || !creditAmount} style={{fontFamily: 'Bodoni Moda Variable', background: creditAction === 'CREDIT' ? '#023020' : '#800020', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: (isMutating || !creditAmount) ? 'not-allowed' : 'pointer', fontWeight: 600, letterSpacing: '0.05rem', opacity: (isMutating || !creditAmount) ? 0.5 : 1 }}>
                                {isMutating ? 'Processing...' : `Confirm ${creditAction}`}
                            </button>
                        </div>
                    }
                >
                    <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Google Sans Code', fontSize: '2.5rem' }}>{(modal.user.computeCredits || 0).toLocaleString()}</h2>
                            <span style={{ fontSize: '0.85rem', color: darkMode ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current Balance</span>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '400px', backgroundColor: darkMode ? '#111827' : '#f3f4f6', padding: '0.5rem', borderRadius: '8px' }}>
                            <button onClick={() => setCreditAction('CREDIT')} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '4px', background: creditAction === 'CREDIT' ? '#023020' : 'transparent', color: creditAction === 'CREDIT' ? 'white' : (darkMode ? '#9ca3af' : '#4b5563'), cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontFamily: 'Bodoni Moda Variable' }}>Credit (+)</button>
                            <button onClick={() => setCreditAction('DEBIT')} style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '4px', background: creditAction === 'DEBIT' ? '#800020' : 'transparent', color: creditAction === 'DEBIT' ? 'white' : (darkMode ? '#9ca3af' : '#4b5563'), cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontFamily: 'Bodoni Moda Variable' }}>Debit (-)</button>
                        </div>

                        <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
                            <i className="fa-solid fa-coins" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: darkMode ? '#9ca3af' : '#6b7280' }}></i>
                            <input 
                                type="number" 
                                placeholder="Enter credit amount..." 
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value ? Number(e.target.value) : '')}
                                style={{ width: '100%', padding: '1rem 1rem 1rem 2.5rem', borderRadius: '8px', border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`, backgroundColor: darkMode ? '#1f2937' : '#fff', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.1rem', fontFamily: 'Google Sans Code', boxSizing: 'border-box', outline: 'none' }}
                            />
                        </div>
                    </div>
                </ExtraLargeModal>, document.body
            )}

            {modal.type === 'STATUS' && modal.user && createPortal(
                <ExtraLargeModal
                    isOpen={modal.isOpen}
                    onClose={closeModal}
                    title={`${modal.user.subscriptionStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'} User Account`}
                    darkMode={darkMode}
                    footer={
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
                            <button onClick={closeModal} disabled={isMutating} style={{ background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#d1d5db' : '#4b5563', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.13em' }}>Cancel</button>
                            <button onClick={submitStatusUpdate} disabled={isMutating} 
                            style={{ background: modal.user.subscriptionStatus === 'ACTIVE' ? '#ef4444' : '#023020', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: isMutating ? 'not-allowed' : 'pointer', 
                            fontWeight: 600, textTransform: 'capitalize', opacity: isMutating ? 0.5 : 1, fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.13em' }}>
                                {isMutating ? 'Processing...' : modal.user.subscriptionStatus === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                            </button>
                        </div>
                    }
                >
                    <div style={{ padding: '1rem 0', fontSize: '0.95rem', color: darkMode ? '#d1d5db' : '#4b5563', lineHeight: 1.6 }}>
                        {modal.user.subscriptionStatus === 'ACTIVE' ? (
                            <>
                                You are about to <strong style={{ color: '#ef4444' }}>Deactivate</strong> the account for <strong>{modal.user.firstName} {modal.user.lastName}</strong>.<br/><br/>
                                This will change their SaaS subscription status to CANCELED, immediately revoking access to foundation models and halting all scheduled nocturnal agents.
                            </>
                        ) : (
                            <>
                                You are about to <strong style={{ color: '#063223' }}>Activate</strong> the account for <strong>{modal.user.firstName} {modal.user.lastName}</strong>.<br/><br/>
                                This will restore their SaaS subscription status to ACTIVE, granting immediate access to their previously configured infrastructure and workflows.
                            </>
                        )}
                    </div>
                </ExtraLargeModal>, document.body
            )}

        </div>
    );
};

const btnStyle = (darkMode: boolean, intent: 'neutral' | 'success' | 'danger') => ({
    background: 'transparent',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    color: intent === 'success' ? '#10b981' : intent === 'danger' ? '#ef4444' : (darkMode ? '#d1d5db' : '#4b5563'),
    width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
});

const infoCard = (darkMode: boolean) => ({
    backgroundColor: darkMode ? '#111827' : '#f9fafb',
    border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
    padding: '1rem',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
});

const infoLabel = (darkMode: boolean) => ({
    fontSize: '0.7rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: darkMode ? '#9ca3af' : '#6b7280',
    fontFamily: 'Google Sans Code'
});

export default AccountsSettings;