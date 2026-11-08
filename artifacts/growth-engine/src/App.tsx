import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Boxes, Building2,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Command,
  Globe2, Layers3, LayoutDashboard, LoaderCircle, LockKeyhole,
  LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, ShoppingBag,
  SlidersHorizontal, Store as StoreIcon, X,
} from 'lucide-react';
import {
  Link, Redirect, Route, Switch, Router as WouterRouter, useLocation,
} from 'wouter';
import type {
  DashboardSummary, FeatureCategory, FeatureDefinition, ImplementationStatus,
  Organization, Store, StorePlatform, StoreFeatureView,
} from '@workspace/api-client-react';
import {
  getGetDashboardSummaryQueryKey, getGetStoreQueryKey, getListFeaturesQueryKey,
  getListOrganizationActivityQueryKey, getListOrganizationsQueryKey, getListStoresQueryKey,
  getListStoreFeaturesQueryKey, useCreateOrganization, useCreateStore,
  useGetDashboardSummary, useGetStore, useHealthCheck, useListFeatures,
  useListOrganizationActivity, useListOrganizations, useListStores,
  useListStoreFeatures, useUpdateOrganization, useUpdateStore, useUpdateStoreFeature,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const categoryLabels: Record<string, string> = {
  foundation: 'Foundation',
  sales_conversion: 'Sales & conversion',
  shopping_experience: 'Shopping experience',
  marketing_recovery: 'Marketing & recovery',
  conversion_psychology: 'Conversion psychology',
  analytics: 'Analytics',
  retention: 'Retention',
  ai_intelligence: 'AI intelligence',
};
const platformLabels: Record<string, string> = {
  shopify: 'Shopify', woocommerce: 'WooCommerce', lovable: 'Lovable',
  react_vite: 'React / Vite', custom_javascript: 'Custom JavaScript',
  custom_html: 'HTML storefront', custom_backend: 'Custom backend', other: 'Other',
};
const statusLabels: Record<string, string> = {
  available: 'Available', in_development: 'In development', planned: 'Planned', not_available: 'Not available',
};
const platformOptions = Object.entries(platformLabels) as [StorePlatform, string][];
const inputClass = 'control-input';
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const statusClass = (status: string) => `status-pill status-${status}`;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function useTenant() {
  const orgQuery = useListOrganizations();
  const organizations = orgQuery.data ?? [];
  const [storedId, setStoredId] = useState(() => localStorage.getItem('growth-current-org') ?? '');
  const activeOrg = organizations.find((org) => org.id === storedId) ?? organizations[0];
  const selectOrg = (organization: Organization) => {
    localStorage.setItem('growth-current-org', organization.id);
    setStoredId(organization.id);
  };
  return { orgQuery, organizations, activeOrg, selectOrg };
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup ${compact ? 'brand-compact' : ''}`}><span className="brand-mark"><Layers3 size={18} strokeWidth={2.1} /></span><span className="brand-name">growth<span>engine</span></span></div>;
}

function HealthMark() {
  const health = useHealthCheck();
  const healthy = health.data?.status === 'ok' || health.data?.status === 'healthy';
  return <span className={`health-mark ${healthy ? 'is-up' : health.isError ? 'is-down' : ''}`} data-testid="status-api-health"><i />{health.isLoading ? 'Checking service' : health.isError ? 'Service unavailable' : healthy ? 'All systems operational' : 'Service status unknown'}</span>;
}

function ErrorState({ title = 'We couldn’t load this view.', detail, retry }: { title?: string; detail?: string; retry: () => void }) {
  return <div className="notice notice-error" role="alert"><div><strong>{title}</strong><p>{detail ?? 'Check your connection and try again.'}</p></div><button className="button button-quiet" onClick={retry} data-testid="button-retry">Try again</button></div>;
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="skeleton-stack" aria-label="Loading"><span className="skeleton skeleton-wide" />{Array.from({ length: count }, (_, i) => <span className="skeleton" key={i} />)}</div>;
}

function PublicHome() {
  return <main className="public-home">
    <header className="public-nav"><Link href="/" className="brand-anchor"><Brand /></Link><nav><a href="#how-it-works">How it works</a><a href="#principles">What’s included</a></nav><div className="public-actions"><Link href="/sign-in" className="button button-quiet">Sign in</Link><Link href="/sign-up" className="button button-dark">Create workspace <ArrowRight size={15} /></Link></div></header>
    <section className="hero-wrap">
      <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> THE OPERATING LAYER FOR COMMERCE</div><h1>Every storefront.<br /><em>One clear view.</em></h1><p className="hero-lede">A steady place to organize your stores and understand what growth capabilities are ready to use — before you switch anything on.</p><div className="hero-actions"><Link href="/sign-up" className="button button-dark button-large">Start your workspace <ArrowRight size={16} /></Link><Link href="/sign-in" className="text-link">Already have an account <ArrowRight size={14} /></Link></div><div className="hero-proof"><div className="proof-avatars"><i>R</i><i>M</i><i>A</i></div><span>Built for the way your business actually runs.</span></div></div>
      <div className="hero-visual" aria-label="Illustration of a unified store and module workspace"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="visual-core"><div className="core-icon"><Layers3 size={27} /></div><span>GROWTH ENGINE</span><strong>Your commerce<br />control plane</strong><div className="core-line" /><small>Clear across every storefront</small></div><div className="float-tag tag-shopify"><span className="tag-dot dot-lime" /> Shopify <small>setup required</small></div><div className="float-tag tag-react"><span className="tag-dot dot-coral" /> React storefront <small>setup required</small></div><div className="float-tag tag-modules"><span className="module-glyph"><Boxes size={14} /></span> 45-module registry</div><div className="visual-caption">A single operating view,<br />without platform lock-in.</div></div>
    </section>
    <section className="trust-strip" id="principles"><div><span className="mini-kicker">A SINGLE WORKSPACE</span><strong>Independent by design</strong><p>Bring your platform choices together without changing how your stores are built.</p></div><div className="platform-wordmarks"><span>Shopify</span><span>WooCommerce</span><span>React</span><span>Lovable</span><span>Custom</span></div></section>
    <section className="public-section" id="how-it-works"><div className="section-heading"><span className="mini-kicker">A GOOD PLACE TO START</span><h2>Structure first.<br /><em>Growth, with context.</em></h2><p>Phase one is focused on the essentials that make a multi-store operation easier to manage.</p></div><div className="steps-list"><article><div className="step-number">01</div><div><h3>Bring your organization together</h3><p>Create one workspace for the people and stores behind your business.</p></div><ArrowUpRight size={17} /></article><article><div className="step-number">02</div><div><h3>Keep every storefront in view</h3><p>Record platform, domain, and connection setup for each store. Connection remains unverified until a connector confirms it.</p></div><ArrowUpRight size={17} /></article><article><div className="step-number">03</div><div><h3>See the full capability map</h3><p>Explore the complete registry, clearly separated into available, in-development, and planned modules.</p></div><ArrowUpRight size={17} /></article></div></section>
    <section className="manifesto"><div className="manifesto-mark"><ShieldCheck size={22} /></div><p>“A control plane should help you see clearly — not claim more than it can do.”</p><span>THE GROWTH ENGINE PRINCIPLE</span></section>
    <footer className="public-footer"><Link href="/" className="brand-anchor"><Brand compact /></Link><span>One workspace for your commerce operations.</span><Link href="/sign-up" className="footer-link">Create your workspace <ArrowRight size={14} /></Link></footer>
  </main>;
}

function HomeRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><PublicHome /></Show></>;
}

function AuthPage({ type }: { type: 'in' | 'up' }) {
  return <main className="auth-page"><div className="auth-aside"><Link href="/" className="brand-anchor"><Brand /></Link><div><span className="mini-kicker">THE COMMERCE CONTROL PLANE</span><h1>All your stores,<br /><em>in their place.</em></h1><p>Sign in to manage the foundations of your commerce operation.</p></div><div className="auth-aside-foot"><HealthMark /><span>Independent storefronts, one reliable workspace.</span></div></div><div className="auth-main"><Link href="/" className="auth-back"><ChevronLeft size={15} /> Back to overview</Link>{type === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}<p className="auth-note"><LockKeyhole size={13} /> Secure access, powered by Clerk</p></div></main>;
}

function SignedOutNotice() {
  return <main className="auth-fallback"><Link href="/" className="brand-anchor"><Brand /></Link><div className="empty-symbol"><LockKeyhole size={23} /></div><span className="mini-kicker">AUTHENTICATION SETUP</span><h1>Sign in is not configured yet.</h1><p>The workspace is ready for Clerk. Add the publishable key to enable account access.</p><Link href="/" className="button button-dark">Back to home</Link></main>;
}

function WorkspaceShell({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  const { user } = useUser();
  const tenant = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  if (tenant.orgQuery.isLoading) return <div className="app-loader"><Brand /><div className="loader-line" /></div>;
  const nav = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/stores', label: 'Stores', icon: StoreIcon },
    { href: '/features', label: 'Feature registry', icon: Boxes },
    { href: '/settings', label: 'Organization', icon: Settings2 },
  ];
  const accountName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Your account';
  const initials = user?.fullName?.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || user?.primaryEmailAddress?.emailAddress?.slice(0, 2).toUpperCase() || 'ME';
  return <div className="workspace">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Link href="/dashboard" className="brand-anchor"><Brand /></Link><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={17} /></button></div>
      <div className="tenant-picker"><span className="tenant-avatar">{tenant.activeOrg?.name.slice(0, 1).toUpperCase() ?? 'G'}</span><div className="tenant-copy"><small>WORKSPACE</small><strong>{tenant.activeOrg?.name ?? 'Your workspace'}</strong></div>{tenant.organizations.length > 1 && <><ChevronDown size={14} /><select className="tenant-selector" aria-label="Switch organization" value={tenant.activeOrg?.id ?? ''} onChange={(event) => { const org = tenant.organizations.find((item) => item.id === event.target.value); if (org) tenant.selectOrg(org); }} data-testid="select-current-organization">{tenant.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></>}</div>
      <span className="nav-label">Workspace</span><nav className="side-nav">{nav.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-item ${location === href ? 'nav-active' : ''}`} onClick={() => setMobileOpen(false)}><Icon size={17} /><span>{label}</span>{href === '/features' && <span className="nav-count">45</span>}</Link>)}</nav>
      <span className="nav-label nav-label-later">Coming later</span><div className="planned-nav"><div><Activity size={16} /><span>Commerce analytics</span><i>Planned</i></div><div><ShoppingBag size={16} /><span>Orders & customers</span><i>Planned</i></div><div><Command size={16} /><span>Automation studio</span><i>Planned</i></div></div>
      <div className="sidebar-bottom"><div className="phase-note"><span className="phase-marker">01</span><div><strong>Foundation phase</strong><small>Tenant & store management</small></div></div><HealthMark /><div className="sidebar-user"><div className="user-initial">{initials}</div><div><strong>{accountName}</strong><small>{tenant.activeOrg?.role ?? 'No organization'}</small></div><button className="icon-button" title="Sign out" onClick={() => clerk.signOut()} data-testid="button-sign-out"><LogOut size={16} /></button></div></div>
    </aside>
    {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
    <div className="app-main"><header className="topbar"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><strong>{nav.find((item) => item.href === location)?.label ?? 'Overview'}</strong></div><div className="topbar-right"><span className="phase-chip"><span /> PHASE 01</span><div className="topbar-avatar">{tenant.activeOrg?.name.slice(0, 1).toUpperCase() ?? 'G'}</div></div></header>{tenant.orgQuery.isError ? <div className="content-wrap"><ErrorState detail="We couldn’t retrieve your organizations." retry={() => tenant.orgQuery.refetch()} /></div> : children}</div>
  </div>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in"><WorkspaceShell>{children}</WorkspaceShell></Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function SetupChecklist({ stores }: { stores: Store[] }) {
  const steps = [
    { label: 'Create your organization', done: true },
    { label: 'Add a storefront', done: stores.length > 0 },
    { label: 'Verify a store connector', done: stores.some((s) => s.connectionStatus === 'connected') },
  ];
  return <div className="setup-card"><div className="setup-card-heading"><div className="small-icon amber"><ShieldCheck size={17} /></div><div><span className="mini-kicker">GETTING STARTED</span><h3>Your workspace is taking shape</h3></div></div><div className="setup-steps">{steps.map((step, i) => <div className="setup-step" key={step.label}><span className={step.done ? 'step-check done' : 'step-check'}>{step.done ? <Check size={12} /> : i + 1}</span><span className={step.done ? 'step-done' : ''}>{step.label}</span>{!step.done && <ArrowRight size={14} />}</div>)}</div><p>Store connections remain in setup required until a connector verifies them.</p></div>;
}

function Dashboard() {
  const tenant = useTenant();
  const orgId = tenant.activeOrg?.id ?? '';
  const summaryQuery = useGetDashboardSummary({ organizationId: orgId }, { query: { enabled: !!orgId, queryKey: getGetDashboardSummaryQueryKey({ organizationId: orgId }) } });
  const storesQuery = useListStores(orgId, { query: { enabled: !!orgId, queryKey: getListStoresQueryKey(orgId) } });
  const activityQuery = useListOrganizationActivity(orgId, { query: { enabled: !!orgId, queryKey: getListOrganizationActivityQueryKey(orgId) } });
  const summary = summaryQuery.data as DashboardSummary | undefined;
  const stores = storesQuery.data ?? [];
  const activity = activityQuery.data ?? summary?.recentActivity ?? [];
  if (tenant.orgQuery.isLoading) return <div className="content-wrap"><SkeletonRows /></div>;
  if (!orgId) return <OrganizationWelcome />;
  return <main className="content-wrap">
    <div className="page-heading"><div><span className="mini-kicker">YOUR COMMERCE OPERATIONS</span><h1>Good morning<span className="heading-period">.</span></h1><p>A clear view of your organization, storefronts, and growth capabilities.</p></div><Link href="/stores" className="button button-dark"><Plus size={16} /> Add a store</Link></div>
    {(summaryQuery.isLoading || storesQuery.isLoading) ? <div className="metric-grid">{[0, 1, 2, 3].map((i) => <div className="metric-card metric-skeleton" key={i}><span className="skeleton" /><span className="skeleton skeleton-wide" /></div>)}</div> : summaryQuery.isError ? <ErrorState detail="Dashboard summary is temporarily unavailable." retry={() => summaryQuery.refetch()} /> : <>
       <div className="metric-grid"><Metric label="Organizations" value={tenant.organizations.length} hint="Your workspaces" icon={<Building2 size={17} />} /><Metric label="Stores" value={summary?.storeCount ?? stores.length} hint={summary?.connectedStoreCount ? `${summary.connectedStoreCount} verified` : 'No verified connectors'} icon={<StoreIcon size={17} />} /><Metric label="Available modules" value={summary?.availableFeatureCount ?? '—'} hint={`${summary?.enabledFeatureCount ?? 0} enabled for stores`} icon={<Boxes size={17} />} /><Metric label="Planned modules" value={summary?.plannedFeatureCount ?? '—'} hint={`${summary?.inDevelopmentFeatureCount ?? 0} in development`} icon={<Clock3 size={17} />} /></div>
      <div className="dashboard-grid"><section className="panel stores-panel"><PanelTitle eyebrow="YOUR STOREFRONTS" title="Stores" aside={<Link href="/stores" className="text-link">View all <ArrowRight size={13} /></Link>} />{storesQuery.isError ? <ErrorState detail="Could not load stores." retry={() => storesQuery.refetch()} /> : stores.length ? <div className="store-list">{stores.slice(0, 4).map((store) => <StoreRow key={store.id} store={store} />)}</div> : <div className="empty-inline"><div className="empty-symbol"><StoreIcon size={20} /></div><strong>No storefronts yet</strong><p>Add the first store to start shaping your workspace.</p><Link href="/stores" className="text-link">Add your first store <ArrowRight size={13} /></Link></div>}</section>
      <section className="panel activity-panel"><PanelTitle eyebrow="AUDIT TRAIL" title="Recent activity" aside={<span className="live-label"><i /> LIVE RECORDS</span>} />{activityQuery.isError ? <ErrorState detail="Could not load audit activity." retry={() => activityQuery.refetch()} /> : activityQuery.isLoading ? <SkeletonRows count={3} /> : activity.length ? <div className="activity-list">{activity.slice(0, 5).map((item) => <div className="activity-item" key={item.id}><span className="activity-dot"><Activity size={13} /></span><div><p>{item.summary}</p><small>{item.action.replaceAll('_', ' ')} · {dateLabel(item.createdAt)}</small></div></div>)}</div> : <div className="empty-activity"><span className="empty-symbol small"><Activity size={16} /></span><p>No activity recorded yet.</p><small>Organization and store changes will appear here.</small></div>}</section></div>
      {summary?.setupState !== 'connected' && <SetupChecklist stores={stores} />}
      <div className="honesty-banner"><span className="honesty-symbol"><ShieldCheck size={17} /></span><p><strong>Trust, before activation.</strong> Only available modules can be configured. Planned capabilities are shown for visibility, never as active features.</p><Link href="/features">Explore the registry <ArrowRight size={13} /></Link></div>
    </>}
  </main>;
}

function Metric({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: ReactNode }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong className="metric-value" data-testid={`metric-${slugify(label)}`}>{value}</strong><small>{hint}</small></div>;
}

function PanelTitle({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return <div className="panel-title"><div><span className="mini-kicker">{eyebrow}</span><h2>{title}</h2></div>{aside}</div>;
}

function StoreRow({ store, onEdit }: { store: Store; onEdit?: (store: Store) => void }) {
  return <div className="store-row"><span className="store-avatar"><StoreIcon size={17} /></span><div className="store-row-main"><strong>{store.name}</strong><span>{store.primaryDomain || platformLabels[store.platform]}</span></div><span className={statusClass(store.connectionStatus)}>{store.connectionStatus === 'connected' ? <BadgeCheck size={12} /> : <Clock3 size={12} />}{store.connectionStatus.replaceAll('_', ' ')}</span>{store.isDefault && <span className="default-pill">DEFAULT</span>}{onEdit && <button className="icon-button" onClick={() => onEdit(store)} aria-label={`Edit ${store.name}`} data-testid={`button-edit-store-${store.id}`}><MoreHorizontal size={17} /></button>}</div>;
}

function OrganizationWelcome() {
  const [, setLocation] = useLocation();
  return <main className="welcome-page"><div className="welcome-art"><div className="welcome-orbit" /><div className="welcome-center"><Layers3 size={32} /><span>YOUR<br />WORKSPACE</span></div><span className="welcome-label label-one">A home for every store</span><span className="welcome-label label-two">Built around your business</span></div><div className="welcome-copy"><span className="mini-kicker">A CLEARER WAY TO OPERATE</span><h1>Start with your<br /><em>organization.</em></h1><p>Bring your storefronts and growth capabilities into one reliable workspace. Your organization is the foundation.</p><button className="button button-dark button-large" onClick={() => setLocation('/organizations/new')}>Create your organization <ArrowRight size={16} /></button><span className="welcome-footnote"><ShieldCheck size={14} /> No store connections are made without your setup.</span></div></main>;
}

function NewOrganization() {
  const tenant = useTenant();
  const create = useCreateOrganization();
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const qc = useQueryClient();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    create.mutate({ data: { name: name.trim() } }, { onSuccess: async (org) => { await qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() }); tenant.selectOrg(org); setLocation('/dashboard'); }, onError: (error) => setMessage(error.message || 'Organization could not be created.') });
  };
  return <main className="content-wrap narrow-content"><div className="back-link-wrap"><Link href="/dashboard" className="text-link"><ChevronLeft size={14} /> Back to overview</Link></div><div className="form-panel"><span className="mini-kicker">NEW WORKSPACE</span><h1>Create your organization</h1><p className="form-intro">This is the shared home for your team’s stores and growth capabilities.</p><form onSubmit={submit}><label className="field-label" htmlFor="org-name">Organization name</label><input id="org-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northstar Supply" minLength={2} maxLength={100} required data-testid="input-organization-name" /><span className="field-help">You can update this name at any time.</span>{message && <p className="form-error">{message}</p>}<button type="submit" className="button button-dark button-large form-submit" disabled={create.isPending} data-testid="button-create-organization">{create.isPending ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create organization</button></form></div><div className="form-side-note"><span className="small-icon"><Building2 size={16} /></span><p>Your organization details are visible only to people with access to this workspace.</p></div></main>;
}

function StoresPage() {
  const tenant = useTenant();
  const orgId = tenant.activeOrg?.id ?? '';
  const storesQuery = useListStores(orgId, { query: { enabled: !!orgId, queryKey: getListStoresQueryKey(orgId) } });
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [currentStoreId, setCurrentStoreId] = useState(() => localStorage.getItem('growth-current-store') ?? '');
  const filtered = useMemo(() => (storesQuery.data ?? []).filter((store) => `${store.name} ${store.primaryDomain ?? ''} ${platformLabels[store.platform]}`.toLowerCase().includes(search.toLowerCase())), [storesQuery.data, search]);
  const saveNew = (data: { name: string; platform: StorePlatform; primaryDomain?: string; isDefault: boolean }) => {
    if (!orgId) return;
    setMessage('');
    createStore.mutate({ organizationId: orgId, data }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListStoresQueryKey(orgId) }); await qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ organizationId: orgId }) }); setShowForm(false); }, onError: (error) => setMessage(error.message || 'Store could not be added.') });
  };
  return <main className="content-wrap"><div className="page-heading"><div><span className="mini-kicker">STORE MANAGEMENT</span><h1>Your stores<span className="heading-period">.</span></h1><p>Keep your storefronts organized, whatever platform they run on.</p></div><button className="button button-dark" onClick={() => { setEditing(null); setShowForm(true); }} data-testid="button-add-store"><Plus size={16} /> Add a store</button></div>
    <div className="store-summary-strip"><span><strong>{storesQuery.data?.length ?? 0}</strong> stores in this workspace</span><span className="strip-divider" /><span><i className="unverified-dot" /> Connections are not verified yet</span></div>
    <div className="list-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by store or domain" aria-label="Search stores" data-testid="input-search-stores" />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</div><span className="list-count">{filtered.length} {filtered.length === 1 ? 'store' : 'stores'}</span></div>
    {message && <div className="notice notice-error"><p>{message}</p><button className="icon-button" onClick={() => setMessage('')}><X size={15} /></button></div>}
    {storesQuery.isLoading ? <div className="panel"><SkeletonRows count={4} /></div> : storesQuery.isError ? <ErrorState detail="We couldn’t retrieve stores for this organization." retry={() => storesQuery.refetch()} /> : filtered.length ? <div className="panel store-table">{filtered.map((store) => <div className="store-table-row" key={store.id}><StoreRow store={store} onEdit={setEditing} /><div className="store-row-meta"><span>Added {dateLabel(store.createdAt)}</span><span>{platformLabels[store.platform]}</span><button className={`switch-store ${currentStoreId === store.id ? 'is-current' : ''}`} onClick={() => { localStorage.setItem('growth-current-store', store.id); setCurrentStoreId(store.id); }} data-testid={`button-switch-store-${store.id}`}>{currentStoreId === store.id ? <><Check size={13} /> Current store</> : 'Switch to store'}</button></div></div>)}</div> : <div className="empty-state"><div className="empty-art"><span /><span /><span /><StoreIcon size={28} /></div><span className="mini-kicker">{search ? 'NO MATCHES' : 'YOUR STOREFRONT PORTFOLIO'}</span><h2>{search ? 'No stores found.' : 'A good portfolio starts here.'}</h2><p>{search ? 'Try another name, domain, or platform.' : 'Add a store record for each storefront you want to manage. Every new connection starts in setup required.'}</p>{!search && <button className="button button-dark" onClick={() => setShowForm(true)}><Plus size={15} /> Add your first store</button>}</div>}
    {showForm && <StoreForm title="Add a store" pending={createStore.isPending} onClose={() => { setShowForm(false); setMessage(''); }} onSubmit={saveNew} />}
    {editing && <EditStoreDialog store={editing} onClose={() => setEditing(null)} onSave={(data) => updateStore.mutate({ storeId: editing.id, data }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListStoresQueryKey(orgId) }); await qc.invalidateQueries({ queryKey: getGetStoreQueryKey(editing.id) }); setEditing(null); }, onError: (error) => setMessage(error.message || 'Store could not be updated.') })} pending={updateStore.isPending} />}
  </main>;
}

function StoreForm({ title, pending, onClose, onSubmit }: { title: string; pending: boolean; onClose: () => void; onSubmit: (data: { name: string; platform: StorePlatform; primaryDomain?: string; isDefault: boolean }) => void }) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<StorePlatform>('shopify');
  const [domain, setDomain] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  return <Modal title={title} onClose={onClose}><p className="modal-intro">Add a storefront record. This does not connect or verify the platform.</p><form onSubmit={(e) => { e.preventDefault(); onSubmit({ name: name.trim(), platform, primaryDomain: domain.trim() || undefined, isDefault }); }}><label className="field-label" htmlFor="store-name">Store name</label><input className={inputClass} id="store-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} placeholder="e.g. Northstar US" data-testid="input-store-name" /><label className="field-label spaced" htmlFor="store-platform">Platform</label><select className={inputClass} id="store-platform" value={platform} onChange={(e) => setPlatform(e.target.value as StorePlatform)} data-testid="select-store-platform">{platformOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="field-label spaced" htmlFor="store-domain">Primary domain <span className="optional">(optional)</span></label><input className={inputClass} id="store-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="store.example.com" maxLength={253} data-testid="input-store-domain" /><label className="check-row"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} data-testid="checkbox-default-store" /><span>Make this my default store</span></label><div className="modal-info"><Clock3 size={14} /><span>Connection status will be set to <strong>setup required</strong> until verified.</span></div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={pending} data-testid="button-save-store">{pending ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add store</button></div></form></Modal>;
}

function EditStoreDialog({ store, onClose, onSave, pending }: { store: Store; onClose: () => void; onSave: (data: { name: string; primaryDomain?: string | null; isDefault?: boolean }) => void; pending: boolean }) {
  const storeQuery = useGetStore(store.id, { query: { queryKey: getGetStoreQueryKey(store.id) } });
  const current = storeQuery.data ?? store;
  const [name, setName] = useState(current.name);
  const [domain, setDomain] = useState(current.primaryDomain ?? '');
  const [isDefault, setIsDefault] = useState(current.isDefault);
  return <Modal title="Edit store details" onClose={onClose}><p className="modal-intro">Update the store record. Platform and connection status are managed by the connector.</p>{storeQuery.isLoading ? <SkeletonRows count={2} /> : storeQuery.isError ? <ErrorState detail="Could not retrieve store details." retry={() => storeQuery.refetch()} /> : <form onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim(), primaryDomain: domain.trim() || null, isDefault }); }}><label className="field-label" htmlFor="edit-store-name">Store name</label><input className={inputClass} id="edit-store-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} data-testid="input-edit-store-name" /><label className="field-label spaced" htmlFor="edit-store-domain">Primary domain</label><input className={inputClass} id="edit-store-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="store.example.com" data-testid="input-edit-store-domain" /><label className="check-row"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} data-testid="checkbox-edit-default" /><span>Make this my default store</span></label><div className="modal-info"><Globe2 size={14} /><span>{platformLabels[current.platform]} · <strong>{current.connectionStatus.replaceAll('_', ' ')}</strong></span></div><div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={pending} data-testid="button-update-store">{pending ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save changes</button></div></form>}</Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><span className="mini-kicker">STORE DETAILS</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button></div>{children}</section></div>;
}

function FeatureRegistry() {
  const tenant = useTenant();
  const orgId = tenant.activeOrg?.id ?? '';
  const storesQuery = useListStores(orgId, { query: { enabled: !!orgId, queryKey: getListStoresQueryKey(orgId) } });
  const [storeId, setStoreId] = useState(() => localStorage.getItem('growth-current-store') ?? '');
  const currentStore = storesQuery.data?.find((store) => store.id === storeId) ?? storesQuery.data?.find((store) => store.isDefault) ?? storesQuery.data?.[0];
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FeatureDefinition | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const params = useMemo(() => ({ ...(category ? { category: category as FeatureCategory } : {}), ...(status ? { implementationStatus: status as ImplementationStatus } : {}), ...(search ? { search: search.trim() } : {}) }), [category, status, search]);
  const featuresQuery = useListFeatures(params, { query: { queryKey: getListFeaturesQueryKey(params) } });
  const storeFeaturesQuery = useListStoreFeatures(currentStore?.id ?? '', { query: { enabled: !!currentStore?.id, queryKey: getListStoreFeaturesQueryKey(currentStore?.id ?? '') } });
  const featureUpdate = useUpdateStoreFeature();
  const qc = useQueryClient();
  const configs = storeFeaturesQuery.data ?? [];
  const configById = useMemo(() => new Map(configs.map((row) => [row.feature.id, row.configuration])), [configs]);
  const list = featuresQuery.data ?? [];
  const totals = {
    all: list.length,
    available: list.filter((f) => f.implementationStatus === 'available').length,
    development: list.filter((f) => f.implementationStatus === 'in_development').length,
    planned: list.filter((f) => f.implementationStatus === 'planned').length,
  };
  const persist = (feature: FeatureDefinition, enabled: boolean, settings: Record<string, unknown>) => {
    if (!currentStore) return;
    setSaveMessage('');
    featureUpdate.mutate({ storeId: currentStore.id, featureId: feature.id, data: { enabled, settings } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListStoreFeaturesQueryKey(currentStore.id) }); await qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ organizationId: orgId }) }); setSaveMessage(`${feature.name} configuration saved.`); }, onError: (error) => setSaveMessage(error.message || 'Configuration could not be saved.') });
  };
  return <main className="content-wrap"><div className="page-heading"><div><span className="mini-kicker">COMPLETE CAPABILITY MAP</span><h1>Feature registry<span className="heading-period">.</span></h1><p>45 modules, with implementation status made clear. Planned does not mean available.</p></div><div className="registry-context"><span className="mini-kicker">CONFIGURING FOR</span><select value={currentStore?.id ?? ''} onChange={(e) => { setStoreId(e.target.value); localStorage.setItem('growth-current-store', e.target.value); }} data-testid="select-feature-store">{storesQuery.data?.length ? storesQuery.data.map((store) => <option value={store.id} key={store.id}>{store.name}</option>) : <option value="">No stores added</option>}</select></div></div>
    <div className="registry-status-line"><span className="registry-total"><Boxes size={15} /> {list.length === 45 ? '45' : list.length} registered modules</span><span className="status-key"><i className="key-dot available-dot" /> Available <strong>{totals.available}</strong></span><span className="status-key"><i className="key-dot dev-dot" /> In development <strong>{totals.development}</strong></span><span className="status-key"><i className="key-dot planned-dot" /> Planned <strong>{totals.planned}</strong></span></div>
    {saveMessage && <div className={`notice ${saveMessage.includes('saved') ? 'notice-success' : 'notice-error'}`}><span>{saveMessage}</span><button className="icon-button" onClick={() => setSaveMessage('')}><X size={15} /></button></div>}
    <div className="registry-controls"><div className="search-field registry-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the registry" aria-label="Search the feature registry" data-testid="input-search-features" /></div><div className="filters"><SlidersHorizontal size={15} /><select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" data-testid="select-feature-category"><option value="">All categories</option>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by implementation status" data-testid="select-feature-status"><option value="">All statuses</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
    {featuresQuery.isLoading ? <div className="feature-list">{[0, 1, 2, 3].map((i) => <div className="feature-skeleton" key={i}><span className="skeleton" /><span className="skeleton skeleton-wide" /></div>)}</div> : featuresQuery.isError ? <ErrorState detail="Could not load the complete feature registry." retry={() => featuresQuery.refetch()} /> : list.length ? <div className="feature-list">{list.map((feature) => <FeatureCard feature={feature} config={configById.get(feature.id)} onOpen={() => setSelected(feature)} key={feature.id} />)}</div> : <div className="empty-state compact-empty"><div className="empty-symbol"><Search size={19} /></div><h2>No registry entries match.</h2><p>Adjust your filters or try a broader search.</p><button className="button button-quiet" onClick={() => { setSearch(''); setCategory(''); setStatus(''); }}>Clear filters</button></div>}
    <div className="registry-footnote"><CircleHelp size={15} /><p>Module availability reflects implementation status, not platform connection. Store setup remains separate and requires connector verification.</p></div>
    {selected && <FeatureDetail feature={selected} config={configById.get(selected.id)} store={currentStore} loading={storeFeaturesQuery.isLoading} pending={featureUpdate.isPending} onClose={() => setSelected(null)} onSave={persist} />}
  </main>;
}

function FeatureCard({ feature, config, onOpen }: { feature: FeatureDefinition; config?: StoreFeatureView['configuration']; onOpen: () => void }) {
  return <button className="feature-card" onClick={onOpen} data-testid={`feature-card-${feature.id}`}><span className="feature-index">{feature.id.slice(0, 2).toUpperCase()}</span><span className="feature-card-main"><span className="feature-meta"><span className="category-label">{categoryLabels[feature.category] ?? feature.category.replaceAll('_', ' ')}</span><span className={statusClass(feature.implementationStatus)}>{feature.implementationStatus === 'available' ? <Check size={11} /> : <Clock3 size={11} />}{statusLabels[feature.implementationStatus]}</span></span><strong>{feature.name}</strong><p>{feature.description}</p><span className="feature-compat">{feature.platformCompatibility.length ? feature.platformCompatibility.slice(0, 4).map((platform) => <i key={platform}>{platformLabels[platform] ?? platform}</i>) : <i>Platform compatibility not specified</i>}{feature.platformCompatibility.length > 4 && <i>+{feature.platformCompatibility.length - 4}</i>}</span></span><span className="feature-right">{config?.enabled && <span className="enabled-flag"><span /> Enabled</span>}<ArrowUpRight size={16} /></span></button>;
}

function FeatureDetail({ feature, config, store, loading, pending, onClose, onSave }: { feature: FeatureDefinition; config?: StoreFeatureView['configuration']; store?: Store; loading: boolean; pending: boolean; onClose: () => void; onSave: (feature: FeatureDefinition, enabled: boolean, settings: Record<string, unknown>) => void }) {
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [settings, setSettings] = useState<Record<string, unknown>>(config?.settings ?? {});
  useEffect(() => {
    setEnabled(config?.enabled ?? false);
    setSettings(config?.settings ?? {});
  }, [feature.id, config?.enabled, config?.updatedAt]);
  const schema = feature.configurationSchema ?? {};
  const properties = typeof schema.properties === 'object' && schema.properties ? schema.properties as Record<string, { type?: string; title?: string; description?: string; default?: unknown; enum?: string[] }> : {};
  const schemaFields = Object.entries(properties);
  const canSave = Boolean(store && feature.implementationStatus === 'available' && feature.canActivate);
  return <div className="detail-scrim" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${feature.name} details`}><div className="detail-header"><span className="mini-kicker">REGISTRY ENTRY · v{feature.version}</span><button className="icon-button" onClick={onClose} aria-label="Close feature details"><X size={18} /></button></div><div className="detail-body"><span className={`detail-category category-${feature.category}`}>{categoryLabels[feature.category] ?? feature.category}</span><h2>{feature.name}</h2><p className="detail-description">{feature.description}</p><div className="detail-status-row"><span className={statusClass(feature.implementationStatus)}>{statusLabels[feature.implementationStatus]}</span><span className="detail-status-note">{feature.canActivate ? 'Activation supported' : 'Activation unavailable'}</span></div>
       <div className="detail-section"><h3>Target platforms</h3><p className="detail-muted">These are architecture targets. Live support depends on a verified connector and its capability checks.</p><div className="platform-chips">{feature.platformCompatibility.length ? feature.platformCompatibility.map((platform) => <span key={platform}>{platformLabels[platform] ?? platform}</span>) : <small>No compatibility details provided.</small>}</div></div>
      <div className="detail-section"><h3>Dependencies <small>{feature.dependencies.length}</small></h3>{feature.dependencies.length ? <ul>{feature.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul> : <p className="detail-muted">No dependencies listed.</p>}</div>
      <div className="detail-section"><h3>Requirements & interfaces</h3><MetaGroup label="Permissions" items={feature.requiredPermissions} /><MetaGroup label="Required data" items={feature.requiredData} /><MetaGroup label="Supported events" items={feature.supportedEvents} /><MetaGroup label="API endpoints" items={feature.apiEndpoints} /><MetaGroup label="Storefront requirements" items={feature.storefrontRequirements} /><MetaGroup label="Testing requirements" items={feature.testingRequirements} /></div>
      <div className="detail-section"><h3>Usage limits</h3><pre className="json-preview">{JSON.stringify(feature.usageLimits ?? {}, null, 2)}</pre></div>
      <div className="detail-section config-section"><h3>Store configuration</h3><p>Configuration is saved to the selected store only. Planned modules cannot be enabled.</p>{store ? <><div className="selected-store-note"><StoreIcon size={14} /><span>{store.name}</span><span className={statusClass(store.connectionStatus)}>{store.connectionStatus.replaceAll('_', ' ')}</span></div>{loading ? <SkeletonRows count={2} /> : <><label className={`config-toggle ${!canSave ? 'toggle-disabled' : ''}`}><span><strong>Enable for this store</strong><small>Only available, activatable modules can be enabled.</small></span><input type="checkbox" checked={enabled} disabled={!canSave} onChange={(e) => setEnabled(e.target.checked)} data-testid={`toggle-feature-${feature.id}`} /></label>{schemaFields.length ? schemaFields.map(([key, field]) => <div className="schema-field" key={key}><label className="field-label" htmlFor={`config-${feature.id}-${key}`}>{field.title ?? key}</label>{field.description && <small>{field.description}</small>}{field.enum ? <select id={`config-${feature.id}-${key}`} className={inputClass} value={String(settings[key] ?? field.default ?? '')} disabled={!canSave} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}>{field.enum.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <input id={`config-${feature.id}-${key}`} className={inputClass} type={field.type === 'number' ? 'number' : 'text'} value={String(settings[key] ?? field.default ?? '')} disabled={!canSave} onChange={(e) => setSettings({ ...settings, [key]: field.type === 'number' ? Number(e.target.value) : e.target.value })} />}</div>) : <p className="detail-muted">No configuration fields are defined for this module.</p>}{!canSave && <div className="notice notice-soft"><LockKeyhole size={14} /><span>{feature.implementationStatus === 'available' ? 'This module cannot be activated for this store.' : 'This module is not available to configure yet.'}</span></div>}<button className="button button-dark save-config" disabled={!canSave || pending} onClick={() => onSave(feature, enabled, settings)} data-testid={`button-save-feature-${feature.id}`}>{pending ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save store configuration</button></>}</> : <div className="notice notice-soft"><StoreIcon size={14} /><span>Add a store to configure store-specific module settings.</span></div>}</div>
    </div></aside></div>;
}

function MetaGroup({ label, items }: { label: string; items: string[] }) {
  return <div className="meta-group"><span>{label}</span>{items.length ? <div>{items.map((item) => <code key={item}>{item}</code>)}</div> : <small>Not specified</small>}</div>;
}

function SettingsPage() {
  const tenant = useTenant();
  const organization = tenant.activeOrg;
  const update = useUpdateOrganization();
  const qc = useQueryClient();
  const [name, setName] = useState(organization?.name ?? '');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const dirty = organization ? name.trim() !== organization.name : false;
  if (!organization) return <OrganizationWelcome />;
  const save = (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setError('');
    update.mutate({ organizationId: organization.id, data: { name: name.trim() } }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListOrganizationsQueryKey() }); setNotice('Organization profile saved.'); }, onError: (issue) => setError(issue.message || 'Could not update organization.') });
  };
  return <main className="content-wrap"><div className="page-heading"><div><span className="mini-kicker">WORKSPACE PREFERENCES</span><h1>Organization<span className="heading-period">.</span></h1><p>Manage the details that identify your workspace.</p></div></div><div className="settings-layout"><nav className="settings-tabs"><span className="settings-tab active"><Building2 size={16} /> Profile</span><span className="settings-tab planned"><LockKeyhole size={15} /> Team & access <i>Later</i></span><span className="settings-tab planned"><Activity size={15} /> Audit log <i>Later</i></span></nav><section className="panel settings-panel"><div className="settings-panel-heading"><span className="mini-kicker">ORGANIZATION PROFILE</span><h2>Workspace identity</h2><p>Your organization name is visible in the workspace navigation and records.</p></div><form onSubmit={save}><label className="field-label" htmlFor="settings-org-name">Organization name</label><input id="settings-org-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} data-testid="input-settings-org-name" /><div className="settings-meta"><span>Workspace slug</span><code>{organization.slug}</code></div><div className="settings-meta"><span>Your role</span><span className="role-badge">{organization.role}</span></div><div className="settings-meta"><span>Created</span><span>{dateLabel(organization.createdAt)}</span></div>{notice && <div className="notice notice-success"><Check size={14} />{notice}</div>}{error && <div className="form-error">{error}</div>}<div className="settings-submit"><button className="button button-dark" disabled={!dirty || update.isPending} data-testid="button-save-organization">{update.isPending ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save changes</button></div></form></section></div><div className="settings-boundary"><ShieldCheck size={16} /><span>Organization roles and access policy are enforced by the platform. Member management is a planned product area.</span></div></main>;
}

function AppRoutes() {
  const routeBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  return <WouterRouter base={routeBase} key={routeBase}><Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/sign-in/*?" component={() => <AuthPage type="in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage type="up" />} />
    <Route path="/organizations/new">{() => <Protected><NewOrganization /></Protected>}</Route>
    <Route path="/dashboard">{() => <Protected><Dashboard /></Protected>}</Route>
    <Route path="/stores">{() => <Protected><StoresPage /></Protected>}</Route>
    <Route path="/features">{() => <Protected><FeatureRegistry /></Protected>}</Route>
    <Route path="/settings">{() => <Protected><SettingsPage /></Protected>}</Route>
    <Route component={NotFound} />
  </Switch></WouterRouter>;
}

function ClerkConfiguredApp() {
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={{
    theme: shadcn, cssLayerName: 'clerk',
    options: { logoPlacement: 'inside', logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
    variables: { colorPrimary: '#b87932', colorForeground: '#293747', colorMutedForeground: '#73808a', colorDanger: '#b94b43', colorBackground: '#fffdf8', colorInput: '#fffdf8', colorInputForeground: '#293747', colorNeutral: '#293747', fontFamily: 'DM Sans, sans-serif', borderRadius: '12px' },
    elements: { rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden', card: '!shadow-none !border-0 !bg-transparent !rounded-none', headerTitle: 'text-[#293747] font-bold', headerSubtitle: 'text-[#73808a]', formFieldLabel: 'text-[#293747] font-semibold', formFieldInput: 'bg-[#fffdf8] text-[#293747] border-[#ddd5c7]', footerActionText: 'text-[#73808a]', footerActionLink: 'text-[#94591e] font-semibold' },
  }} routerPush={(to) => { window.history.pushState(null, '', stripBase(to)); window.dispatchEvent(new PopStateEvent('popstate')); }} routerReplace={(to) => { window.history.replaceState(null, '', stripBase(to)); window.dispatchEvent(new PopStateEvent('popstate')); }}><AppRoutes /></ClerkProvider>;
}

function MissingClerkApp() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Switch><Route path="/" component={PublicHome} /><Route path="/sign-in/*?">{() => <SignedOutNotice />}</Route><Route path="/sign-up/*?">{() => <SignedOutNotice />}</Route><Route component={() => <SignedOutNotice />} /></Switch></WouterRouter>;
}

function App() {
  return <QueryClientProvider client={queryClient}><div className="app-frame">{clerkPubKey ? <ClerkConfiguredApp /> : <MissingClerkApp />}</div></QueryClientProvider>;
}

export default App;
