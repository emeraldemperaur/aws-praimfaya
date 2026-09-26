import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import DataTable, { type ColumnDef } from '../components/datatable';
import SearchRibbon from '../components/searchribbon';
import ExtraLargeModal from '../components/extralargemodal';
import BottomRightModal from '../components/bottomrightmodal';
import { CubeIcon } from '../components/cube';
import { TIMEZONES } from '../utils/chronos';
import { NATIVE_TOOLS_TEMPLATES } from '../utils/prometheus';

const client = generateClient<Schema>();

interface AccountsSettingsProps {
    searchQuery: string; 
    darkMode?: boolean;
}

type UserProfile = Schema['UserProfile']['type'];
type AgentActivity = Schema['AgentActivity']['type'];

interface ModalState {
    isOpen: boolean;
    type: 'MANAGE' | 'CREDIT' | 'STATUS' | null;
    user: UserProfile | null;
}

const AccountsSettings: React.FC<AccountsSettingsProps> = ({ searchQuery, darkMode = false }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [ribbonSearch, setRibbonSearch] = useState('');
    const [selectedFilter, setSelectedFilter] = useState('ALL');
    const [modal, setModal] = useState<ModalState>({ isOpen: false, type: null, user: null });
    const [isMutating, setIsMutating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeUserMetrics, setActiveUserMetrics] = useState({ activityCount: 0, integrationsCount: 0, isLoading: false });
    const [creditAmount, setCreditAmount] = useState<number | ''>('');
    const [creditAction, setCreditAction] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
    const [roleSelection, setRoleSelection] = useState<string>('standard');
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [userActivities, setUserActivities] = useState<AgentActivity[]>([]);
    const [isFetchingActivities, setIsFetchingActivities] = useState(false);
    const [isKillingGlobal, setIsKillingGlobal] = useState(false);
    const [killingLocalId, setKillingLocalId] = useState<string | null>(null);
    const [notification, setNotification] = useState<{isOpen: boolean, title: string, message: string, type: 'SUCCESS' | 'ERROR'}>({ isOpen: false, title: '', message: '', type: 'SUCCESS' });
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, action: 'GLOBAL_KILL' | null}>({ isOpen: false, action: null });

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

    const submitRoleUpdate = async () => {
        if (!modal.user) return;
        setIsUpdatingRole(true);
        try {
            const response = await client.mutations.updateUserGroup({
                targetCognitoUserId: modal.user.cognitoUserId,
                groupName: roleSelection
            });
            
            if (response.data) {
                setNotification({
                    isOpen: true,
                    title: 'Role Assigned',
                    message: `Successfully elevated user identity group to: ${roleSelection.toUpperCase()}`,
                    type: 'SUCCESS'
                });
            } else {
                setNotification({
                    isOpen: true,
                    title: 'Role Assignment Failed',
                    message: 'The IAM policy rejected the request. Please verify Lambda permissions.',
                    type: 'ERROR'
                });
            }
        } catch (err) {
            console.error('[Vanguard] Role update error:', err);
            setNotification({
                isOpen: true,
                title: 'System Exception',
                message: 'An unexpected error occurred while communicating with AWS Cognito.',
                type: 'ERROR'
            });
        } finally {
            setIsUpdatingRole(false);
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
            setNotification({ isOpen: true, title: 'Credits Updated', message: `Successfully ${creditAction === 'CREDIT' ? 'added' : 'removed'} ${creditAmount} credits.`, type: 'SUCCESS' });
        } catch (err) {
            console.error("[Vanguard] Credit transaction failed", err);
            setNotification({ isOpen: true, title: 'Transaction Failed', message: 'Transaction failed. Please check IAM permissions or AWS logs.', type: 'ERROR' });
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
            setNotification({ isOpen: true, title: 'Status Updated', message: `User status is now ${newStatus}.`, type: 'SUCCESS' });
        } catch (err) {
            console.error("[Vanguard] Status update failed", err);
            setNotification({ isOpen: true, title: 'Update Failed', message: 'Failed to update status. Please check connection.', type: 'ERROR' });
        } finally {
            setIsMutating(false);
        }
    };

    const handleOpenActivityDrawer = async () => {
        if (!modal.user) return;
        setIsDrawerOpen(true);
        setIsFetchingActivities(true);
        try {
            const { data } = await client.models.AgentActivity.list({
                filter: { userId: { eq: modal.user.cognitoUserId } },
                limit: 100,
                selectionSet: ['id', 'lifecycleState', 'toolName', 'inputTokens', 'outputTokens', 'computeCredits', 'createdAt', 'durationMs', 'terminalId', 'thoughtLog', 'scheduledFor'] as any
            });
            const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            setUserActivities(sorted as unknown as AgentActivity[]);
            
        } catch (err) {
            console.error("[Vanguard] Failed to fetch user activities", err);
            setNotification({ isOpen: true, title: 'Telemetry Error', message: 'Failed to retrieve agent activity logs.', type: 'ERROR' });
        } finally {
            setIsFetchingActivities(false);
        }
    };

    const initiateGlobalKill = () => {
        if (!modal.user) return;
        setConfirmModal({ isOpen: true, action: 'GLOBAL_KILL' });
    };

    const executeGlobalKill = async () => {
        if (!modal.user) return;
        
        setConfirmModal({ isOpen: false, action: null });
        setIsKillingGlobal(true);
        
        try {
            const response = await client.models.AgentActivity.list({
                filter: { userId: { eq: modal.user.cognitoUserId } } 
            });
            
            const activeTerminals = Array.from(new Set(
                response.data
                .filter(a => ['RUNNING', 'SLEEPING', 'BLOCKED'].includes(a.lifecycleState || ''))
                .map(a => a.terminalId)
            ));
            
            if (activeTerminals.length === 0) {
                setNotification({ isOpen: true, title: 'No Agents Found', message: 'User has no active or scheduled agents to halt.', type: 'SUCCESS' });
                return;
            }

            for (const tId of activeTerminals) {
                await client.models.ConsoleTerminal.update({ id: tId, haltRequested: true });
                await client.models.AgentActivity.create({
                     terminalId: tId, 
                     userId: modal.user.cognitoUserId, 
                     lifecycleState: 'FAILED',
                     toolName: 'admin_kill_switch', 
                     thoughtLog: 'Administrator manually triggered a Global Kill Switch. Active execution cancelled.', 
                     durationMs: 0
                });
            }
            
            setNotification({ isOpen: true, title: 'Agents Terminated', message: `Successfully halted operations across ${activeTerminals.length} terminal(s).`, type: 'SUCCESS' });
            if (isDrawerOpen) handleOpenActivityDrawer(); 
            
        } catch (error) {
            console.error("[Vanguard] Global kill error", error);
            setNotification({ isOpen: true, title: 'Halt Failed', message: 'Failed to halt agents. Check AWS CloudWatch for details.', type: 'ERROR' });
        } finally {
            setIsKillingGlobal(false);
        }
    };

    const submitLocalKill = async (activityId: string, terminalId: string) => {
        setKillingLocalId(activityId);
        try {
            await client.models.ConsoleTerminal.update({ id: terminalId, haltRequested: true });
            setUserActivities(prev => prev.map(a => a.id === activityId ? { ...a, lifecycleState: 'FAILED' } : a));
        } catch(err) {
            console.error("[Vanguard] Local halt error", err);
            setNotification({ isOpen: true, title: 'Halt Failed', message: 'Could not halt the specific operation.', type: 'ERROR' });
        } finally {
            setKillingLocalId(null);
        }
    };

    const getStateBadge = (state: string | null | undefined) => {
        switch (state) {
            case 'RUNNING': return <span style={{ color: '#3b82f6', fontWeight: 600 }}>🟢 Running</span>;
            case 'SLEEPING': return <span style={{ color: '#eab308', fontWeight: 600 }}>🟡 Scheduled</span>;
            case 'BLOCKED': return <span style={{ color: '#f97316', fontWeight: 600 }}>🟠 Blocked (HITL)</span>;
            case 'FAILED': return <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 Failed</span>;
            case 'COMPLETED': return <span style={{ color: '#10b981', fontWeight: 600 }}>🔵 Completed</span>;
            default: return <span style={{ color: '#9ca3af', fontWeight: 600 }}>⚪ Unknown</span>;
        }
    };

    const closeModal = () => {
        setModal({ isOpen: false, type: null, user: null });
        setCreditAmount('');
        setCreditAction('CREDIT');
        setRoleSelection('standard');
        setIsDrawerOpen(false);
    };

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
                                <strong style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={TIMEZONES.find(tz => tz.tzIdentifier === modal.user?.timeZone)?.label || modal.user.timeZone || 'UTC'}>
                                    {TIMEZONES.find(tz => tz.tzIdentifier === modal.user?.timeZone)?.label || modal.user.timeZone || 'UTC'}
                                </strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
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

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                            <button onClick={handleOpenActivityDrawer} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', border: `1px solid ${darkMode ? '#6366f1' : '#4f46e5'}`, color: darkMode ? '#818cf8' : '#4f46e5', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', fontFamily: 'Bodoni Moda Variable', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <i className="fa-solid fa-list-check"></i> Manage Agent Activity
                            </button>
                            <button onClick={initiateGlobalKill} disabled={isKillingGlobal} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#800020', border: 'none', color: 'white', borderRadius: '6px', cursor: isKillingGlobal ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', opacity: isKillingGlobal ? 0.6 : 1, fontFamily: 'Bodoni Moda Variable', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {isKillingGlobal ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-radiation"></i>}
                                {isKillingGlobal ? 'Halting Operations...' : 'Global Kill Switch'}
                            </button>
                        </div>

                        <div style={{ borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', fontSize: '1.1rem' }}>Access & Role Assignment</h4>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: darkMode ? '#111827' : '#f9fafb', padding: '1rem', borderRadius: '8px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                                
                                <div style={{ flex: 1 }}>
                                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>Cognito Identity Group</strong>
                                    <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280', fontFamily: 'Google Sans Code' }}>Elevate or restrict platform access levels.</span>
                                </div>

                                <select 
                                    value={roleSelection} 
                                    onChange={(e) => setRoleSelection(e.target.value)}
                                    style={{ 
                                        padding: '0.65rem 1rem', 
                                        borderRadius: '6px', 
                                        backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                                        color: darkMode ? '#f9fafb' : '#111827',
                                        border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                                        fontFamily: 'Google Sans Code',
                                        minWidth: '200px'
                                    }}
                                >
                                    <option value="standard">Standard User</option>
                                    <option value="admin">Administrator</option>
                                    <option value="superadmin">Super Admin</option>
                                    <option value="heda">Heda</option>
                                </select>
                                
                                <button 
                                    onClick={submitRoleUpdate} 
                                    disabled={isUpdatingRole}
                                    style={{
                                        padding: '0.65rem 1.5rem',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: isUpdatingRole ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        fontFamily: 'Bodoni Moda Variable',
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        opacity: isUpdatingRole ? 0.5 : 1,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {isUpdatingRole ? 'Updating...' : 'Apply Role'}
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

            {isDrawerOpen && createPortal(
                <>
                    <div onClick={() => setIsDrawerOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10001 }}></div>
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px', maxWidth: '100%',
                        backgroundColor: darkMode ? '#111827' : '#ffffff', borderLeft: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                        zIndex: 10002, display: 'flex', flexDirection: 'column',
                        boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', fontFamily: 'Google Sans Code, monospace'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <div>
                                <h2 style={{ margin: '0 0 0.25rem 0', color: darkMode ? '#f9fafb' : '#111827', fontSize: '1.25rem', fontFamily: 'Bodoni Moda Variable, serif' }}>Agent Telemetry</h2>
                                <span style={{ fontSize: '0.75rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>Target User ID: {modal.user?.cognitoUserId}</span>
                            </div>
                            <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', color: darkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', fontSize: '1.5rem' }}><i className="bx bx-x"></i></button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {isFetchingActivities ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                    <CubeIcon width={30} height={30} darkMode={darkMode} edgeColor={darkMode ? '#ffffff' : '#0B0B45'} animationDuration="2s" />
                                    <span style={{ marginTop: '1rem', fontSize: '0.85rem', fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.1em' }}>LOADING TELEMETRY...</span>
                                </div>
                            ) : userActivities.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem 0', color: darkMode ? '#6b7280' : '#9ca3af', fontSize: '0.85rem' }}>
                                    No agent activity recorded for this user profile.
                                </div>
                            ) : (
                                userActivities.map(act => (
                                    <div key={act.id} style={{ backgroundColor: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', padding: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                            <div style={{ fontSize: '0.75rem' }}>{getStateBadge(act.lifecycleState)}</div>
                                            <div style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>{new Date(act.createdAt).toLocaleString()}</div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: darkMode ? '#f9fafb' : '#111827', marginBottom: '0.75rem', fontWeight: 600 }}>
                                            <i className="fa-solid fa-wrench" style={{ marginRight: '0.5rem', color: '#6366f1' }}></i>
                                            {act.toolName || 'Reasoning Engine'}
                                        </div>
                                        <div style={{ backgroundColor: darkMode ? '#111827' : '#ffffff', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem', color: darkMode ? '#d1d5db' : '#4b5563', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '100px', overflowY: 'auto', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}` }}>
                                            {act.thoughtLog || 'Executing reasoning trace...'}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, paddingTop: '0.75rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                                                <i className="fa-solid fa-microchip" style={{ marginRight: '0.25rem' }}></i> {act.modelId?.split('/')[1] || 'us.amazon.nova'}
                                            </span>
                                            {(act.lifecycleState === 'RUNNING' || act.lifecycleState === 'SLEEPING' || act.lifecycleState === 'BLOCKED') && (
                                                <button 
                                                    onClick={() => submitLocalKill(act.id, act.terminalId)}
                                                    disabled={killingLocalId === act.id}
                                                    style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444450', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: killingLocalId === act.id ? 'not-allowed' : 'pointer' }}
                                                >
                                                    {killingLocalId === act.id ? 'Halting...' : 'Halt Agent'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>,
                document.body
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
                                You are about to <strong style={{ color: '#169b6e' }}>Activate</strong> the account for <strong>{modal.user.firstName} {modal.user.lastName}</strong>.<br/><br/>
                                This will restore their SaaS subscription status to ACTIVE, granting immediate access to their previously configured infrastructure and workflows.
                            </>
                        )}
                    </div>
                </ExtraLargeModal>, document.body
            )}

            {notification.isOpen && createPortal(
                <BottomRightModal
                    isOpen={notification.isOpen}
                    onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                    title={notification.title}
                    icon={<i className={`fa-solid ${notification.type === 'SUCCESS' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} style={{ color: notification.type === 'SUCCESS' ? '#10b981' : '#ef4444' }}></i>}
                    darkMode={darkMode}
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <button 
                                onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))} 
                                style={{ 
                                    background: notification.type === 'SUCCESS' ? '#10b981' : '#800020', 
                                    color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: 'pointer', 
                                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Bodoni Moda Variable' 
                                }}
                            >
                                Acknowledged
                            </button>
                        </div>
                    }
                >
                    <div style={{ fontSize: '0.9rem', color: darkMode ? '#d1d5db' : '#4b5563', lineHeight: 1.5, fontFamily: 'Google Sans Code, monospace' }}>
                        {notification.message}
                    </div>
                </BottomRightModal>,
                document.body
            )}

            {confirmModal.isOpen && createPortal(
                <BottomRightModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ isOpen: false, action: null })}
                    title="Confirm Global Halt"
                    icon={<i className="fa-solid fa-radiation" style={{ color: '#800020' }}></i>}
                    darkMode={darkMode}
                    footer={
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', width: '100%' }}>
                            <button 
                                onClick={() => setConfirmModal({ isOpen: false, action: null })} 
                                style={{ background: 'transparent', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, color: darkMode ? '#d1d5db' : '#4b5563', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', 
                                fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.13em' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeGlobalKill} 
                                style={{ background: '#800020', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: 'pointer', 
                                    fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.13em', fontFamily: 'Bodoni Moda Variable' }}
                            >
                                Confirm Halt
                            </button>
                        </div>
                    }
                >
                    <div style={{ fontSize: '0.9rem', color: darkMode ? '#d1d5db' : '#4b5563', lineHeight: 1.5, fontFamily: 'Bodoni Moda Variable, monospace' }}>
                        Are you absolutely sure?<br/><br/>This will permanently halt all active and scheduled agents for this user. 
                        <br/><br/>
                        <strong style={{ color: darkMode ? '#9e0f33' : '#dc2626' }}>This action cannot be undone.</strong>
                    </div>
                </BottomRightModal>,
                document.body
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