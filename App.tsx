
import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import { User, UserRole, SystemSetting } from './types';
import { ShieldAlert, RefreshCw, WifiOff } from 'lucide-react';
import { adminService, authService } from './services/mockBackend';

// Lazy Load các trang để tối ưu tốc độ tải bundle ban đầu
const MapPage = lazy(() => import('./pages/MapPage'));
const AdministrativeMapPage = lazy(() => import('./pages/administrativemap'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const Messaging = lazy(() => import('./pages/Messaging'));
const Notifications = lazy(() => import('./pages/Notifications'));
const QRGenerator = lazy(() => import('./components/tools/QRGenerator'));
const CoordinateConverter = lazy(() => import('./components/tools/CoordinateConverter'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const LandPriceLookup = lazy(() => import('./pages/LandPriceLookup'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => (
    <div className="h-full w-full bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4 animate-in fade-in duration-300">
        <div className="relative">
            <RefreshCw className="animate-spin text-blue-500" size={40} />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
            </div>
        </div>
        <p className="font-display uppercase tracking-[0.3em] text-[9px] text-blue-400 font-black animate-pulse">
            Đang nạp Module hệ thống...
        </p>
    </div>
);

// Bản đồ ánh xạ giữa ID Menu và URL Path
const PATH_MAPPING: Record<string, string> = {
    'map': '/',
    'thematic': '/donvihanhchinh',
    'dashboard': '/thongke',
    'editor': '/chinhsuabanve',
    'profile': '/hoso',
    'messaging': '/tinnhan',
    'notifications': '/thongbao',
    'qr-generator': '/taomaqr',
    'coordinate-converter': '/chuyendoihetoado',
    'land-price': '/giadata',
    'admin': '/quantri',
    'about': '/gioithieu'
};

// Bản đồ ngược để highlight Sidebar dựa trên URL
const REVERSE_PATH_MAPPING: Record<string, string> = Object.entries(PATH_MAPPING).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
}, {} as Record<string, string>);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
    const hasBootedRef = useRef(false);
    const bootRunIdRef = useRef(0);

  const navigate = useNavigate();
  const location = useLocation();

  // Xác định activePage cho Sidebar dựa trên URL hiện tại
  const currentPath = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`;
  const activePage = REVERSE_PATH_MAPPING[currentPath] || 
                     (location.pathname.startsWith('/quantri') ? 'admin' : 
                     (location.pathname.startsWith('/taomaqr') ? 'qr-generator' :
                     (location.pathname.startsWith('/chuyendoihetoado') ? 'coordinate-converter' :
                     'map')));

  const boot = async () => {
      const runId = ++bootRunIdRef.current;
      setLoading(true);
      setBootError(null);
      
      const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
              if (runId === bootRunIdRef.current) {
                  reject(new Error("Server không phản hồi kịp lúc (Timeout)"));
              }
          }, 12000);
      }
      );

      try {
          const loadDataPromise = (async () => {
              const settings: SystemSetting[] = await adminService.getSettings();
              const settingsMap: Record<string, string> = {};
              settings.forEach(s => settingsMap[s.key] = s.value);
              
              const savedUser = localStorage.getItem('geo_user');
              if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
                  let localUser: any;
                  try { localUser = JSON.parse(savedUser); } catch { localStorage.removeItem('geo_user'); return { settingsMap, user: null }; }
                  try {
                      const freshUser = await authService.getProfile(localUser.id);
                      if (freshUser) return { settingsMap, user: { ...localUser, ...freshUser } };
                  } catch (e) { return { settingsMap, user: localUser }; }
              }
              return { settingsMap, user: null };
          })();

          const result: any = await Promise.race([loadDataPromise, timeoutPromise]);
          
          if (runId !== bootRunIdRef.current) return;

          setSystemSettings(result.settingsMap);
          if (result.user) {
              setUser(result.user);
              localStorage.setItem('geo_user', JSON.stringify(result.user));
          }
          
          if (result.settingsMap['system_name']) document.title = result.settingsMap['system_name'];
          
          if (result.settingsMap['site_favicon']) {
              const favicon = document.getElementById('favicon') as HTMLLinkElement;
              if (favicon) {
                  favicon.href = result.settingsMap['site_favicon'];
              }
          }
      } catch (e: any) {
          if (runId !== bootRunIdRef.current) return;
          console.error("Khởi động thất bại:", e.message);
          setBootError(e.message || "Không thể kết nối đến máy chủ API.");
      } finally {
          if (runId === bootRunIdRef.current) {
              setLoading(false);
          }
      }
  };

  useEffect(() => {
      if (hasBootedRef.current) return;
      hasBootedRef.current = true;

      const params = new URLSearchParams(window.location.search);
      if (params.get('token')) { setResetToken(params.get('token')); setShowLogin(true); }
      if (params.get('verificationToken')) { setVerificationToken(params.get('verificationToken')); setShowLogin(true); }
      boot();

      const handleResize = () => {
          if (window.innerWidth < 768) {
              setIsSidebarCollapsed(true);
          } else {
              setIsSidebarCollapsed(false);
          }
      };
      const handleSettingsUpdated = (event: Event) => {
          const customEvent = event as CustomEvent<Record<string, string>>;
          const nextSettings = customEvent.detail || {};
          setSystemSettings(prev => ({ ...prev, ...nextSettings }));

          if (nextSettings['system_name']) {
              document.title = nextSettings['system_name'];
          }

          if (nextSettings['site_favicon']) {
              const favicon = document.getElementById('favicon') as HTMLLinkElement;
              if (favicon) {
                  favicon.href = nextSettings['site_favicon'];
              }
          }
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('system-settings-updated', handleSettingsUpdated as EventListener);
      return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('system-settings-updated', handleSettingsUpdated as EventListener);
      };
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('geo_user', JSON.stringify(loggedInUser));
    setShowLogin(false);
    setResetToken(null);
    setVerificationToken(null);
    // Điều hướng dựa trên role sau khi login
    navigate(loggedInUser.role === UserRole.ADMIN ? '/quantri' : '/thongke');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('geo_user');
    navigate('/');
  };

  const handleNavigate = (pageId: string, routePath?: string) => {
      if (routePath && routePath.startsWith('/')) {
          navigate(routePath);
          return;
      }
      const path = PATH_MAPPING[pageId];
      if (path) {
          navigate(path);
      }
  };

  // Protected Route Wrapper
  const ProtectedRoute = ({ children, requiredRole }: { children?: React.ReactNode, requiredRole?: UserRole }) => {
      if (!user) return <Navigate to="/" replace />;
      if (requiredRole && user.role !== requiredRole && user.role !== UserRole.ADMIN) {
          return <Navigate to="/" replace />;
      }
      return <>{children}</>;
  };

  if (bootError) return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
              <WifiOff className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Cảnh báo hệ thống</h1>
          <p className="text-slate-400 max-w-md text-sm mb-8 leading-relaxed">
              {bootError === "Server không phản hồi kịp lúc (Timeout)" 
                ? "Máy chủ đang gặp tình trạng quá tải hoặc kết nối Internet của bạn không ổn định." 
                : bootError}
          </p>
          <button 
            onClick={boot}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2"
          >
              <RefreshCw size={16}/> Thử kết nối lại
          </button>
      </div>
  );

  if (loading) return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
          <div className="relative">
              <RefreshCw className="animate-spin text-blue-500" size={48} />
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
              </div>
          </div>
          <p className="font-display uppercase tracking-[0.3em] text-[10px] text-blue-400 font-black animate-pulse">QLDDHCM Đang khởi động...</p>
      </div>
  );

  if (showLogin) return (
      <Login 
        onLogin={handleLogin} 
        onCancel={() => { setShowLogin(false); setResetToken(null); setVerificationToken(null); }}
        systemName={systemSettings['system_name']}
        logoUrl={systemSettings['site_logo']}
        footerText={systemSettings['footer_text']}
        allowRegistration={systemSettings['allow_registration'] === 'true'}
        initialToken={resetToken}
        verificationToken={verificationToken}
      />
  );

  // Render 404 toàn màn hình — trước khi vào layout sidebar
    const KNOWN_PATHS = ['/', '/donvihanhchinh', '/giadata', '/taomaqr', '/chuyendoihetoado', '/gioithieu', '/thongke', '/chinhsuabanve', '/hoso', '/tinnhan', '/thongbao', '/quantri'];
  const isKnownPath = KNOWN_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
  if (!isKnownPath) return (
      <Suspense fallback={<PageLoader />}>
          <NotFound />
      </Suspense>
  );

  if (systemSettings['maintenance_mode'] === 'true' && user?.role !== UserRole.ADMIN) return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <ShieldAlert className="text-orange-500 mb-6" size={64} />
          <h1 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-tighter">Hệ thống bảo trì</h1>
          <p className="text-slate-500 text-sm">Chúng tôi đang nâng cấp hệ thống để phục vụ tốt hơn.</p>
          <button onClick={() => setShowLogin(true)} className="text-blue-500 hover:underline mt-8 font-bold text-xs uppercase tracking-widest">Dành cho Quản trị viên</button>
      </div>
  );

  return (
    <div className="flex h-screen w-full bg-gray-900 overflow-hidden font-sans relative">
      {!location.pathname.startsWith('/quantri') && (
        <Sidebar 
          user={user} 
          activePage={activePage} 
          onNavigate={handleNavigate} 
          onLogout={handleLogout}
          onLoginClick={() => setShowLogin(true)}
          onCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isCollapsed={isSidebarCollapsed}
          systemName={systemSettings['system_name']}
          logoUrl={systemSettings['site_logo']}
          sidebarToolsConfig={systemSettings['sidebar_tools'] || ''}
        />
      )}
      <main className={`flex-1 h-full relative overflow-hidden bg-gray-100 flex flex-col transition-all ${location.pathname.startsWith('/quantri') ? 'w-full' : ''}`}>
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path="/" element={<MapPage user={user} systemSettings={systemSettings} />} />
                <Route path="/donvihanhchinh" element={<AdministrativeMapPage user={user} systemSettings={systemSettings} />} />
                <Route path="/giadata" element={<LandPriceLookup user={user} systemSettings={systemSettings} />} />
                <Route path="/taomaqr" element={<QRGenerator />} />
                <Route path="/chuyendoihetoado" element={<CoordinateConverter />} />
                <Route path="/gioithieu" element={<About />} />
                
                {/* Protected Routes */}
                <Route path="/thongke" element={<ProtectedRoute><Dashboard user={user!} /></ProtectedRoute>} />
                <Route path="/chinhsuabanve" element={<ProtectedRoute><EditorPage user={user!} /></ProtectedRoute>} />
                <Route path="/hoso" element={<ProtectedRoute><UserProfile user={user!} onUpdateUser={u => { setUser(u); localStorage.setItem('geo_user', JSON.stringify(u)); }} /></ProtectedRoute>} />
                <Route path="/tinnhan" element={<ProtectedRoute><Messaging user={user!} /></ProtectedRoute>} />
                <Route path="/thongbao" element={<ProtectedRoute><Notifications user={user!} /></ProtectedRoute>} />
                
                {/* Admin Route */}
                <Route path="/quantri" element={
                    <ProtectedRoute>
                        <AdminPage user={user} systemName={systemSettings['system_name']} logoUrl={systemSettings['site_logo']} />
                    </ProtectedRoute>
                } />
            </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;
