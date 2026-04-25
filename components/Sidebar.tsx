
import React, { useState, useEffect, useMemo } from 'react';
import { User, MenuItem } from '../types';
import { LogOut, LogIn, ChevronLeft, ChevronRight, ChevronDown, User as UserIcon, Database, HelpCircle, ExternalLink, Bell, X, Menu, FolderCog, QrCode, ArrowRightLeft } from 'lucide-react';
import * as Icons from 'lucide-react';
import { adminService, notificationService, API_URL } from '../services/mockBackend';

interface SidebarProps {
  user: User | null;
  activePage: string;
  onNavigate: (page: string, routePath?: string) => void;
  onLogout: () => void;
  onLoginClick: () => void;
  onCollapse: () => void;
  isCollapsed: boolean;
  systemName?: string;
  logoUrl?: string;
  sidebarToolsConfig?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    user, 
    activePage, 
    onNavigate, 
    onLogout, 
    onLoginClick, 
    onCollapse, 
    isCollapsed,
    systemName, 
    logoUrl,
    sidebarToolsConfig
}) => {
  const [dynamicMenu, setDynamicMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const DEFAULT_TOOL_ITEMS = [
    { id: 'qr-generator', label: 'Tạo mã QR', icon: QrCode as React.ElementType, path: '/taomaqr' },
    { id: 'coordinate-converter', label: 'Chuyển hệ tọa độ', icon: ArrowRightLeft as React.ElementType, path: '/chuyendoihetoado' }
  ];

  const toolItems = useMemo(() => {
    if (sidebarToolsConfig) {
      try {
        const parsed = JSON.parse(sidebarToolsConfig);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const parsedWithoutBlog = parsed.filter((t: any) => t?.id !== 'blog-gis');
          const parsedIds = new Set(parsedWithoutBlog.map((t: any) => t.id));
          const mappedParsed = parsed
            .filter((t: any) => t.enabled && t.id !== 'blog-gis')
            .map((t: any) => ({
              id: t.id,
              label: t.label,
              icon: ((Icons as any)[t.icon] as React.ElementType) || FolderCog,
              path: t.path
            }));

          const appendedDefaults = DEFAULT_TOOL_ITEMS.filter((d) => !parsedIds.has(d.id));
          return [...mappedParsed, ...appendedDefaults];
        }
      } catch {}
    }
    return DEFAULT_TOOL_ITEMS;
  }, [sidebarToolsConfig]);

  const toolItemIds = useMemo(() => toolItems.map(t => t.id), [toolItems]);

  const [isToolsOpen, setIsToolsOpen] = useState(() => toolItemIds.some(id => id === activePage));  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
      setImgError(false);
  }, [user?.avatar]);

  useEffect(() => {
      if (toolItemIds.some(id => id === activePage)) {
          setIsToolsOpen(true);
      }
  }, [activePage]);

  useEffect(() => {
      const fetchMenu = async () => {
          try {
              if (adminService && typeof adminService.getMenuItems === 'function') {
                  const items = await adminService.getMenuItems();
                  setDynamicMenu(items.filter(i => i.is_active).sort((a, b) => a.order_index - b.order_index));
              }
          } catch (e) {
              console.error("Failed to load sidebar menu", e);
          } finally {
              setLoading(false);
          }
      };
      fetchMenu();
  }, [user?.role]);

  useEffect(() => {
      if (!user) {
          setUnreadCount(0);
          return;
      }

      const fetchUnreadCount = async () => {
          try {
              const data = await notificationService.getNotifications();
              const lastRead = localStorage.getItem(`last_read_noti_${user.id}`) || '0';
              const count = data.filter(n => new Date(n.created_at).getTime() > parseInt(lastRead, 10)).length;
              setUnreadCount(count);
          } catch {
              setUnreadCount(0);
          }
      };

      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 60000);
      return () => clearInterval(interval);
  }, [user]);

  const handleOpenNotificationsPage = () => {
      onNavigate('notifications');
      if (user) {
          localStorage.setItem(`last_read_noti_${user.id}`, Date.now().toString());
      }
      setUnreadCount(0);
      if (window.innerWidth < 768 && !isCollapsed) {
          onCollapse();
      }
  };

  const visibleItems = dynamicMenu.filter(item => {
    if (toolItemIds.includes(item.id)) return false;
    if (!user && item.id === 'notifications') return false;
    if (!user) return item.roles.includes('GUEST');
    return item.roles.includes(user.role);
  });

  const handleMenuClick = (item: MenuItem) => {
      if (item.type === 'EXTERNAL' && item.url) {
          window.open(item.url, '_blank');
      } else if (item.id === 'notifications') {
          handleOpenNotificationsPage();
      } else {
        const internalPath = item.url?.startsWith('/') ? item.url : undefined;
        onNavigate(item.id, internalPath);
          // Auto close on mobile after navigation
          if (window.innerWidth < 768 && !isCollapsed) {
              onCollapse();
          }
      }
  };

  const getAvatarUrl = (path?: string) => {
      if (!path) return null;
      if (path.startsWith('http') || path.startsWith('data:')) return path;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
      return `${baseUrl}${cleanPath}?cache_bust=${new Date().getTime()}`;
  };

  const renderAvatar = () => {
      if (!user) return <UserIcon size={18} className="text-blue-400" />;
      const avatarSrc = getAvatarUrl(user.avatar);
      if (avatarSrc && !imgError) {
          return <img src={avatarSrc} alt={user.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />;
      }
      return (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs uppercase">
              {user.name ? user.name.charAt(0) : <UserIcon size={16} />}
          </div>
      );
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={onCollapse}
        className={`md:hidden fixed top-4 left-4 z-[500] p-2.5 bg-slate-900/90 backdrop-blur-md text-white rounded-xl shadow-xl border border-slate-700 transition-all ${!isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <Menu size={22} />
      </button>

      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-[500] backdrop-blur-sm transition-opacity"
          onClick={onCollapse}
        />
      )}

      <div className={`fixed md:relative z-[510] h-screen bg-[#0f172a] text-white flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 shadow-2xl
        ${isCollapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-72'}
      `}>
        <button 
          onClick={onCollapse} 
          className="hidden md:block absolute -right-3 top-10 bg-blue-600 text-white rounded-full p-1.5 shadow-lg border-2 border-[#0f172a] hover:bg-blue-500 transition-all z-[60]"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Mobile Close Button */}
        <button 
          onClick={onCollapse} 
          className="md:hidden absolute right-4 top-6 text-slate-400 hover:text-white transition-colors z-[60]"
        >
          <X size={24} />
        </button>

        <div className={`p-6 border-b border-slate-800/80 flex flex-col items-center ${isCollapsed ? 'justify-center' : 'items-start'}`}>
          <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3.5">
                  {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                  ) : (
                      <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
                          <Database className="w-5 h-5 text-white" />
                      </div>
                  )}
                  {!isCollapsed && (
                      <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                          <h1 className="text-base font-black text-white leading-none uppercase tracking-tighter mb-1">
                              {systemName || 'GeoMaster'}
                          </h1>
                          <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <p className="text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase">Enterprise</p>
                          </div>
                      </div>
                  )}
                </div>
                </div>
              </div>

        <div className="flex-1 py-6 space-y-1.5 overflow-y-auto custom-scrollbar no-scrollbar px-3">
          {loading ? (
              <div className="animate-pulse flex flex-col gap-3 px-2">
                  {[1,2,3].map(i => <div key={i} className="h-11 bg-slate-800/50 rounded-xl w-full"></div>)}
              </div>
          ) : visibleItems.map(item => {
            const isActive = activePage === item.id;
            const isNotiItem = item.id === 'notifications';
            let IconComponent = (Icons as any)[item.icon] || HelpCircle;

            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item)}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all relative group overflow-hidden ${
                  isActive 
                    ? 'text-white bg-blue-600 shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className={`${isCollapsed ? 'mx-auto' : ''} transition-transform group-hover:scale-110 flex items-center z-10 relative`}>
                  <IconComponent size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} />
                  {isNotiItem && unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-slate-800 animate-pulse">
                          {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                  )}
                </div>
                
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between animate-in fade-in slide-in-from-left-2 duration-300 z-10">
                      <span className={`font-bold text-xs uppercase tracking-wide ${isActive ? 'text-white' : ''}`}>
                        {item.label}
                        {isNotiItem && unreadCount > 0 && !isCollapsed && (
                            <span className="ml-2 inline-flex items-center justify-center min-w-4 h-4 px-1 bg-red-600 text-white text-[9px] font-black rounded-full">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                      </span>
                      {item.type === 'EXTERNAL' && (
                          <ExternalLink size={12} className="text-slate-500 group-hover:text-white transition-colors" />
                      )}
                  </div>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-800/70">
            <button
              onClick={() => {
                if (isCollapsed) {
                  onCollapse();
                  setIsToolsOpen(true);
                  return;
                }
                setIsToolsOpen(!isToolsOpen);
              }}
              title={isCollapsed ? 'Tiện ích' : ''}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all group ${
                toolItemIds.some(id => id === activePage)
                  ? 'text-white bg-emerald-600/20 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <div className={`${isCollapsed ? 'mx-auto' : ''} transition-transform group-hover:scale-110`}>
                <FolderCog size={20} className={toolItemIds.some(id => id === activePage) ? 'text-emerald-300' : 'text-slate-400 group-hover:text-emerald-400'} />
              </div>
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide">Tiện ích</span>
                  <ChevronDown size={16} className={`transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
                </div>
              )}
            </button>

            {!isCollapsed && isToolsOpen && (
              <div className="mt-2 ml-3 space-y-1 border-l border-slate-700 pl-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {toolItems.map((item) => {
                  const isActive = activePage === item.id;
                  const ToolIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuClick({ id: item.id, label: item.label, icon: '', roles: ['GUEST', 'VIEWER', 'EDITOR', 'ADMIN'], order_index: 0, is_active: true, type: 'INTERNAL', url: item.path })}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
                    >
                      <ToolIcon size={16} className={isActive ? 'text-white' : 'text-emerald-400'} />
                      <span className="text-[11px] font-black uppercase tracking-wide">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 backdrop-blur-sm">
          {user ? (
            <div className="flex flex-col gap-3">

              {!isCollapsed ? (
                <div 
                  onClick={() => {
                      onNavigate('profile');
                      if (window.innerWidth < 768) onCollapse();
                  }}
                  className="flex items-center gap-3.5 p-2.5 rounded-xl cursor-pointer hover:bg-slate-800 transition-all group border border-transparent hover:border-slate-700/50"
                  title="Cập nhật hồ sơ"
                >
                    <div className="w-10 h-10 rounded-full border-2 border-slate-700 group-hover:border-blue-500 overflow-hidden shrink-0 shadow-lg transition-all">
                      {renderAvatar()}
                    </div>
                    <div className="overflow-hidden flex-1">
                        <p className="text-xs font-black text-white truncate group-hover:text-blue-400 transition-colors">
                            {user.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'ADMIN' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                            {user.role}
                        </p>
                    </div>
                </div>
              ) : (
                   <div 
                      onClick={() => {
                          onNavigate('profile');
                          if (window.innerWidth < 768) onCollapse();
                      }} 
                      className="w-10 h-10 mx-auto rounded-full border-2 border-slate-700 hover:border-blue-500 overflow-hidden cursor-pointer mb-3 shadow-lg transition-all"
                      title={user.name}
                   >
                      {renderAvatar()}
                   </div>
              )}

              <button 
                onClick={() => {
                    onLogout();
                    if (window.innerWidth < 768) onCollapse();
                }}
                title={isCollapsed ? "Đăng xuất" : ""}
                className={`flex items-center gap-3 px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/10 hover:border-red-500 ${isCollapsed ? 'justify-center' : ''}`}
              >
                <LogOut size={18} />
                {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Đăng xuất</span>}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                  onLoginClick();
                  if (window.innerWidth < 768) onCollapse();
              }}
              className="w-full flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-900/30 group"
            >
              <LogIn size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-widest">Đăng nhập</span>}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
