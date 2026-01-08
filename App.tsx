
import React, { useState, useEffect, useRef } from 'react';
import { ProjectRecord, RoomRecord, Language, LocationType, User, InteriorItem } from './types';
import { TRANSLATIONS, BUILDING_TYPES, COLORS, CULTURE_MODES } from './constants';
import { Navbar, Footer } from './components/Layout';
import { Chatbot } from './components/Chatbot';
import { PlotVisualizer } from './components/Visualizer';
import { 
  getArchitecturalAnalysis, 
  generateBuildingRenders, 
  generateInteriorRender, 
  getBudgetBreakdown, 
  analyzePlotImage,
  generateCustomRoomRender,
  getInteriorItemizedBudget
} from './services/gemini';
import { 
  Plus, Camera, LayoutGrid, ChevronRight, Briefcase, 
  Clock, Building2, Upload, X, ZoomIn, Info, RefreshCw, Sparkles, User as UserIcon,
  Circle, Image as ImageIcon, ArrowRight, CheckCircle2, DollarSign, Maximize2, LogOut, Loader2, Trash2, Hash, Sofa, ReceiptText, Key, Palette, Eye, Layout, Search, Grid,
  Sliders, MoveVertical, MoveHorizontal, ShoppingCart, ArrowLeftRight, FilePlus
} from 'lucide-react';

type AnalysisTab = 'visualization' | 'interior' | 'budget';
type Perspective = 'front' | 'side';
type ViewMode = 'dashboard' | 'analytics' | 'rooms' | 'admin_lookup';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<{ role: 'CLIENT' | 'DEVELOPER'; mode: 'login' | 'register' } | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('visualization');
  const [showOriginal, setShowOriginal] = useState(false);
  const [activePerspective, setActivePerspective] = useState<Perspective>('front');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roomFileInputRef = useRef<HTMLInputElement>(null);

  const [searchClientId, setSearchClientId] = useState('');
  const [lookupResult, setLookupResult] = useState<{ projects: ProjectRecord[], rooms: RoomRecord[] } | null>(null);

  const [formData, setFormData] = useState<Partial<ProjectRecord>>({
    buildingName: '',
    clientName: '',
    totalArea: 0,
    length: 0,
    breadth: 0,
    buildingType: BUILDING_TYPES[0],
    location: LocationType.URBAN,
    budget: '',
    mainColor: COLORS[0].value,
    style: CULTURE_MODES[0],
    floors: 1,
    roomsPerFloor: 2
  });

  const [roomData, setRoomData] = useState<Partial<RoomRecord>>({
    type: '',
    length: 0,
    breadth: 0,
    area: 0,
    budget: '',
    primaryColor: COLORS[0].name,
    colorRange: 'neutral',
  });
  const [roomHistory, setRoomHistory] = useState<RoomRecord[]>([]);
  const [roomPreviewImage, setRoomPreviewImage] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomViewMode, setRoomViewMode] = useState<'after' | 'before'>('after');

  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(err => console.error("Video play failed:", err));
    }
  }, [isCameraOpen]);

  const updateBuildingDimensions = (field: 'l' | 'b' | 'a', value: number) => {
    setFormData(prev => {
      let l = prev.length || 0;
      let b = prev.breadth || 0;
      let a = prev.totalArea || 0;
      if (field === 'l') { l = value; a = l * b; } 
      else if (field === 'b') { b = value; a = l * b; } 
      else if (field === 'a') {
        a = value;
        if (a > 0) {
          if (l > 0) b = parseFloat((a / l).toFixed(2));
          else if (b > 0) l = parseFloat((a / b).toFixed(2));
          else { l = parseFloat(Math.sqrt(a).toFixed(2)); b = l; }
        }
      }
      return { ...prev, length: l, breadth: b, totalArea: a };
    });
  };

  const updateRoomDimensions = (field: 'l' | 'b' | 'a', value: number) => {
    setRoomData(prev => {
      let l = prev.length || 0;
      let b = prev.breadth || 0;
      let a = prev.area || 0;
      if (field === 'l') { l = value; a = l * b; } 
      else if (field === 'b') { b = value; a = l * b; } 
      else if (field === 'a') {
        a = value;
        if (a > 0) {
          if (l > 0) b = parseFloat((a / l).toFixed(2));
          else if (b > 0) l = parseFloat((a / b).toFixed(2));
          else { l = parseFloat(Math.sqrt(a).toFixed(2)); b = l; }
        }
      }
      return { ...prev, length: l, breadth: b, area: a };
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = credentials;
    const role = authView?.role || 'CLIENT';
    let success = (role === 'CLIENT' && username === 'client@zerobuild.ai' && password === '123456') ||
                  (role === 'DEVELOPER' && username === 'admin@zerobuild.ai' && password === '789000');
    if (success) {
      const userId = role === 'CLIENT' ? 'CLIENT-8293' : 'ADMIN-0001';
      setCurrentUser({ id: userId, username, role, fullName: username.split('@')[0] });
      setAuthView(null);
      setViewMode(role === 'CLIENT' ? 'dashboard' : 'admin_lookup');
    } else alert("Invalid Credentials.");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthView(null);
    setCurrentProject(null);
    setPreviewImage(null);
    setLookupResult(null);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) { alert("Camera error."); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const handleNewProject = () => {
    setFormData({
      buildingName: '',
      clientName: '',
      totalArea: 0,
      length: 0,
      breadth: 0,
      buildingType: BUILDING_TYPES[0],
      location: LocationType.URBAN,
      budget: '',
      mainColor: COLORS[0].value,
      style: CULTURE_MODES[0],
      floors: 1,
      roomsPerFloor: 2
    });
    setPreviewImage(null);
    setCurrentProject(null);
    setViewMode('dashboard');
  };

  const handleNewRoomDesign = () => {
    setRoomData({
      type: '',
      length: 0,
      breadth: 0,
      area: 0,
      budget: '',
      primaryColor: COLORS[0].name,
      colorRange: 'neutral',
    });
    setRoomPreviewImage(null);
    setSelectedRoomId(null);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      setIsFlashing(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        setPreviewImage(base64);
        setIsLoading(true);
        analyzePlotImage(base64).then(analysis => {
          if (analysis) {
            setFormData(prev => ({
              ...prev,
              length: analysis.length || prev.length,
              breadth: analysis.breadth || prev.breadth,
              totalArea: analysis.totalArea || prev.totalArea
            }));
          }
        }).finally(() => { setIsLoading(false); stopCamera(); });
      }
      setTimeout(() => setIsFlashing(false), 150);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPreviewImage(base64);
        setIsLoading(true);
        try {
          const analysis = await analyzePlotImage(base64);
          if (analysis) {
            setFormData(prev => ({
              ...prev,
              length: analysis.length || prev.length,
              breadth: analysis.breadth || prev.breadth,
              totalArea: analysis.totalArea || prev.totalArea
            }));
          }
        } finally { setIsLoading(false); }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminSearch = () => {
    if (!searchClientId.trim()) return;
    const clientProjects = projects.filter(p => p.clientId === searchClientId);
    const clientRooms = roomHistory.filter(r => r.clientId === searchClientId);
    setLookupResult({ projects: clientProjects, rooms: clientRooms });
  };

  const generateProject = async () => {
    if (!formData.buildingName || !formData.totalArea || !currentUser) {
        alert("Please provide Project Title and Site Dimensions.");
        return;
    }
    setIsLoading(true);
    try {
      const baseProject: ProjectRecord = {
        ...formData as ProjectRecord,
        id: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId: currentUser.id,
        clientName: currentUser.fullName || 'Private Client',
        date: new Date().toLocaleDateString()
      };
      const [frontRender, sideRender, analysisText, interior, budget] = await Promise.all([
        generateBuildingRenders(baseProject, previewImage, 'front'),
        generateBuildingRenders(baseProject, previewImage, 'side'),
        getArchitecturalAnalysis(baseProject, lang),
        generateInteriorRender(baseProject),
        getBudgetBreakdown(baseProject)
      ]);
      const finalProject = { 
        ...baseProject, 
        beforeImage: previewImage || frontRender.before,
        afterImage: frontRender.after, 
        afterImageSide: sideRender.after,
        interiorImage: interior,
        budgetBreakdown: budget,
        constructionSteps: analysisText 
      };
      setCurrentProject(finalProject);
      setProjects(prev => [finalProject, ...prev]);
      setViewMode('analytics');
      setActiveTab('visualization');
      setActivePerspective('front');
    } catch (err: any) {
      alert(err.message || "Synthesis failed.");
    } finally { setIsLoading(false); }
  };

  const handleGenerateRoom = async () => {
    if (!roomData.type || !roomData.area || !currentUser) {
      alert("Please provide Room Type and Dimensions.");
      return;
    }
    setIsLoading(true);
    try {
      const payload: RoomRecord = {
        id: `ROOM-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId: currentUser.id,
        type: roomData.type || 'Room',
        length: roomData.length || 0,
        breadth: roomData.breadth || 0,
        area: roomData.area || 0,
        budget: roomData.budget || '0',
        primaryColor: roomData.primaryColor || COLORS[0].name,
        colorRange: 'neutral',
        beforeImage: roomPreviewImage || undefined,
        date: new Date().toLocaleDateString()
      };
      const [visual, budgetItems] = await Promise.all([
        generateCustomRoomRender(payload),
        getInteriorItemizedBudget(payload)
      ]);
      const finishedRoom: RoomRecord = { ...payload, afterImage: visual, items: budgetItems };
      setRoomHistory(prev => [finishedRoom, ...prev]);
      setSelectedRoomId(finishedRoom.id);
      setRoomPreviewImage(null);
      setRoomViewMode('after');
    } catch (err: any) {
      alert("Interior Synthesis failed: " + err.message);
    } finally { setIsLoading(false); }
  };

  const renderAdminLookup = () => (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 max-w-7xl mx-auto pb-24">
      <header className="space-y-2">
         <h2 className="text-5xl font-black text-white heading-font tracking-tight">Admin Console</h2>
         <p className="text-slate-500 text-xl font-medium">Enterprise Record Management & Data Access.</p>
      </header>
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl space-y-10">
        <div className="max-w-2xl mx-auto space-y-6 text-center">
          <h3 className="text-2xl font-black text-white heading-font">Client Data Retrieval</h3>
          <div className="flex gap-4">
            <div className="flex-1 flex bg-slate-950 border border-slate-800 p-2 rounded-2xl shadow-inner focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
              <div className="w-12 flex items-center justify-center text-slate-600"><Hash size={20} /></div>
              <input type="text" placeholder="Enter Client ID (e.g. CLIENT-8293)" className="w-full bg-transparent p-4 text-white outline-none text-lg font-bold" value={searchClientId} onChange={e => setSearchClientId(e.target.value)} />
            </div>
            <button onClick={handleAdminSearch} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95">Access Records</button>
          </div>
        </div>
        {lookupResult && (
          <div className="grid lg:grid-cols-2 gap-12 pt-10 border-t border-slate-800">
             <div className="space-y-8">
                <div className="flex items-center justify-between px-4">
                  <h4 className="text-xl font-black text-white flex items-center gap-3"><Building2 className="text-indigo-500" /> Buildings</h4>
                  <span className="bg-indigo-600/10 text-indigo-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-indigo-500/20">{lookupResult.projects.length} Found</span>
                </div>
                {lookupResult.projects.length > 0 ? (
                  <div className="space-y-4">
                    {lookupResult.projects.map(p => (
                      <div key={p.id} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between hover:border-indigo-500/50 transition-all cursor-pointer" onClick={() => { setCurrentProject(p); setViewMode('analytics'); }}>
                        <div className="flex items-center gap-5">
                          <img src={p.afterImage} className="w-16 h-16 rounded-2xl object-cover shadow-xl" />
                          <div>
                             <p className="text-white font-black text-lg">{p.buildingName}</p>
                             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{p.id} • {p.date}</p>
                          </div>
                        </div>
                        <ChevronRight className="text-slate-600" />
                      </div>
                    ))}
                  </div>
                ) : <div className="p-16 border-2 border-dashed border-slate-800 rounded-3xl text-center opacity-40">No Buildings</div>}
             </div>
             <div className="space-y-8">
                <div className="flex items-center justify-between px-4">
                  <h4 className="text-xl font-black text-white flex items-center gap-3"><Sofa className="text-emerald-500" /> Interiors</h4>
                  <span className="bg-emerald-600/10 text-emerald-400 text-[10px] font-black px-4 py-1.5 rounded-full border border-emerald-500/20">{lookupResult.rooms.length} Found</span>
                </div>
                {lookupResult.rooms.length > 0 ? (
                  <div className="space-y-4">
                    {lookupResult.rooms.map(r => (
                      <div key={r.id} className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 flex items-center justify-between hover:border-emerald-500/50 transition-all cursor-pointer">
                        <div className="flex items-center gap-5">
                          <img src={r.afterImage} className="w-16 h-16 rounded-2xl object-cover shadow-xl" />
                          <div>
                             <p className="text-white font-black text-lg">{r.type}</p>
                             <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{r.id} • Budget: ₹{r.budget}</p>
                          </div>
                        </div>
                        <Eye className="text-slate-600" />
                      </div>
                    ))}
                  </div>
                ) : <div className="p-16 border-2 border-dashed border-slate-800 rounded-3xl text-center opacity-40">No Interiors</div>}
             </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderRoomsView = () => {
    const selectedRoom = roomHistory.find(r => r.id === selectedRoomId);
    return (
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 max-w-7xl mx-auto pb-24">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div className="space-y-2">
             <h2 className="text-5xl font-black text-white heading-font tracking-tight">Interior Studio</h2>
             <p className="text-slate-500 text-xl font-medium">Professional room planning & aesthetic synthesis.</p>
          </div>
          <button onClick={handleNewRoomDesign} className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all active:scale-95">
             <FilePlus size={20} /> New Design
          </button>
        </header>
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-[3rem] p-10 space-y-8 shadow-2xl relative">
            <div className="space-y-6">
               <div className="space-y-6">
                  <div className="relative group">
                    <input type="file" ref={roomFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setRoomPreviewImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <button onClick={() => roomFileInputRef.current?.click()} className="w-full h-48 bg-slate-950 border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-indigo-500/50 transition-all group overflow-hidden shadow-inner">
                       {roomPreviewImage ? (
                         <img src={roomPreviewImage} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                       ) : (
                         <>
                           <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-all shadow-xl"><Upload size={28} /></div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upload Existing Room</p>
                         </>
                       )}
                    </button>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Room Type</label>
                     <input type="text" placeholder="Lounge, Bedroom..." className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-white outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-bold shadow-inner" value={roomData.type} onChange={e => setRoomData(p => ({ ...p, type: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Interior Budget (₹)</label>
                     <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-2xl shadow-inner focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                        <div className="w-12 flex items-center justify-center text-slate-600 font-black">₹</div>
                        <input type="text" placeholder="0" className="w-full bg-transparent p-3 text-white outline-none text-sm font-bold" value={roomData.budget || ''} onChange={e => setRoomData(p => ({ ...p, budget: e.target.value }))} />
                     </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Area (sq ft)</label>
                       <input type="number" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-white outline-none text-sm font-bold" value={roomData.area || ''} onChange={e => updateRoomDimensions('a', Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Length (ft)</label>
                        <input type="number" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-white outline-none text-sm font-bold" value={roomData.length || ''} onChange={e => updateRoomDimensions('l', Number(e.target.value))} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Breadth (ft)</label>
                        <input type="number" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-white outline-none text-sm font-bold" value={roomData.breadth || ''} onChange={e => updateRoomDimensions('b', Number(e.target.value))} />
                     </div>
                  </div>
                  <div className="space-y-3 pt-2">
                     <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-2"><Palette size={12} /> Color Box</label>
                     <div className="flex flex-wrap gap-2">
                        {COLORS.map(c => (
                           <button key={c.value} onClick={() => setRoomData(p => ({ ...p, primaryColor: c.name }))} className={`w-9 h-9 rounded-full border-2 transition-all ${roomData.primaryColor === c.name ? 'border-indigo-500 scale-110 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'border-slate-800'}`} style={{ backgroundColor: c.value }} />
                        ))}
                     </div>
                  </div>
               </div>
               <button onClick={handleGenerateRoom} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 shadow-2xl active:scale-95 disabled:opacity-50 transition-all">{isLoading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />} Synthesize Design</button>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-12">
             {selectedRoom ? (
               <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl relative">
                     <div className="aspect-video relative group bg-slate-950">
                        <img src={roomViewMode === 'after' ? selectedRoom.afterImage : (selectedRoom.beforeImage || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1600')} className="w-full h-full object-cover transition-transform duration-[4000ms] group-hover:scale-105" />
                        <div className="absolute top-8 left-8 flex items-center gap-4">
                           <button onClick={() => setRoomViewMode(p => p === 'after' ? 'before' : 'after')} className="bg-white/10 hover:bg-white/20 backdrop-blur-xl p-3 rounded-2xl border border-white/10 text-white transition-all shadow-2xl flex items-center gap-2 font-black uppercase text-[9px] tracking-widest"><ArrowLeftRight size={16} /> {roomViewMode === 'after' ? 'View Before' : 'View After'}</button>
                        </div>
                     </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 shadow-2xl space-y-10">
                     <h3 className="text-3xl font-black text-white heading-font">Interior Budget & Sourcing</h3>
                     <div className="grid gap-4">{selectedRoom.items?.map((item, idx) => (
                           <div key={idx} className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-700/50 flex justify-between items-center group hover:border-indigo-500/50 transition-all">
                              <div className="flex gap-5 items-center"><div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-indigo-400"><ShoppingCart size={24} /></div><div><p className="text-white font-black text-lg">{item.name}</p><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Estimated Indian Market Cost</p></div></div>
                              <div className="flex items-center gap-6"><p className="text-2xl font-black text-white heading-font">{item.price}</p><a href={item.buyLink} target="_blank" rel="noopener noreferrer" className="bg-[#2874f0] hover:bg-[#1a5bbd] text-white px-8 py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest">Flipkart</a></div>
                           </div>
                        ))}</div>
                  </div>
               </div>
             ) : <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-20 opacity-30"><Sofa size={80} className="text-slate-700 mb-8" /><h3 className="text-3xl font-black text-white heading-font mb-4 uppercase tracking-tighter">Interior Canvas Awaiting</h3><p className="text-slate-500 max-w-md text-lg">Define your room parameters to view architectural visuals and budget breakdowns.</p></div>}
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (!currentProject) return null;
    switch (activeTab) {
      case 'visualization':
        const displayImage = showOriginal ? currentProject.beforeImage : (activePerspective === 'front' ? currentProject.afterImage : currentProject.afterImageSide);
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="relative group overflow-hidden rounded-[2.5rem] border border-indigo-600/30 shadow-2xl bg-slate-900 flex items-center justify-center transition-all aspect-video">
                {displayImage ? <img src={displayImage} className={`w-full h-full object-cover transition-all duration-1000 ${isZoomed ? 'scale-150' : 'scale-100'}`} /> : <div className="flex flex-col items-center justify-center gap-6 p-20 text-center"><Loader2 className="animate-spin text-indigo-500" size={48} /><p className="font-black uppercase tracking-[0.4em] text-[10px] text-slate-400">Synthesizing {activePerspective.toUpperCase()} Perspective...</p></div>}
                <div className="absolute top-6 left-6 flex flex-col sm:flex-row gap-3"><div className="bg-slate-900/95 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl"><div className={`w-1.5 h-1.5 rounded-full ${showOriginal ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} /><p className="text-[9px] font-black uppercase tracking-widest text-white">{showOriginal ? 'Base Land View' : `AI Masterpiece [${activePerspective.toUpperCase()}]`}</p></div><button onClick={() => setShowOriginal(!showOriginal)} className="bg-white/10 hover:bg-white/20 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl"><RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />{showOriginal ? 'Return to AI' : 'Inspect Plot'}</button></div>
                {!showOriginal && <div className="absolute top-6 right-6 flex flex-col gap-3 items-end"><div className="flex bg-slate-900/95 backdrop-blur-xl p-1 rounded-xl border border-white/10 shadow-2xl"><button onClick={() => { setActivePerspective('front'); setShowOriginal(false); }} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activePerspective === 'front' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Front View</button><button onClick={() => { setActivePerspective('side'); setShowOriginal(false); }} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${activePerspective === 'side' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Side View</button></div></div>}
                <button onClick={() => setIsZoomed(!isZoomed)} className="absolute bottom-6 right-6 bg-indigo-600/90 hover:bg-indigo-600 backdrop-blur-xl border border-indigo-500/30 p-3.5 rounded-xl text-white shadow-2xl transition-all"><ZoomIn size={22} /></button>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center space-y-1"><Maximize2 className="mx-auto text-indigo-500 mb-2" size={24} /><p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Site Area</p><p className="text-xl font-black text-white heading-font">{currentProject.totalArea} sqft</p></div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center space-y-1"><Building2 className="mx-auto text-indigo-500 mb-2" size={24} /><p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Levels</p><p className="text-xl font-black text-white heading-font">{currentProject.floors}</p></div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center space-y-1"><Sofa className="mx-auto text-indigo-500 mb-2" size={24} /><p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Rooms</p><p className="text-xl font-black text-white heading-font">{currentProject.roomsPerFloor}</p></div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-center space-y-1"><span className="text-indigo-500 font-black text-2xl mb-2 block leading-none">₹</span><p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Budget</p><p className="text-xl font-black text-white heading-font">{currentProject.budget}</p></div>
             </div>
          </div>
        );
      case 'interior':
        return <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"><div className="relative group overflow-hidden rounded-[2.5rem] border border-indigo-600/30 shadow-2xl bg-slate-900 flex items-center justify-center aspect-video">{currentProject.interiorImage ? <img src={currentProject.interiorImage} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center justify-center gap-4 py-32"><Loader2 className="animate-spin text-indigo-500" size={48} /><p className="font-black uppercase tracking-widest text-slate-500">Generating Furnishing Concepts...</p></div>}</div></div>;
      case 'budget':
        return <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500"><div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 shadow-2xl overflow-hidden relative"><header className="mb-10 text-center sm:text-left"><h2 className="text-4xl font-black text-white heading-font tracking-tight">Market Costs</h2><p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Sourcing Analysis for {currentProject.id}</p></header><div className="space-y-4">{currentProject.budgetBreakdown?.map((item, idx) => (<div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-slate-800/40 rounded-3xl border border-slate-700/50 hover:border-indigo-500/50 transition-all group gap-4"><div><p className="text-indigo-400 text-[9px] font-black uppercase tracking-widest mb-1">{item.category}</p><p className="text-white font-black text-lg">{item.item}</p><p className="text-slate-500 text-[10px] mt-1">Sourced from: {item.source}</p></div><div className="text-right w-full sm:w-auto"><p className="text-white font-black text-2xl heading-font">{item.estimate}</p></div></div>))}</div></div></div>;
    }
  };

  if (!currentUser) {
    if (!authView) {
      return (
        <div className="min-h-screen bg-[#020617] flex flex-col">
          <Navbar lang={lang} onLangChange={setLang} onHistoryClick={() => setShowHistory(true)} onLogout={handleLogout} isLoggedIn={false} />
          <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent)] pointer-events-none"></div>
            <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center justify-between gap-16 relative z-10">
              <div className="flex-1 text-center lg:text-left animate-in slide-in-from-left-12 duration-1000">
                <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mb-12 mx-auto lg:mx-0 shadow-2xl hover:rotate-6 transition-transform cursor-pointer"><Building2 size={56} /></div>
                <h1 className="text-8xl md:text-[11rem] font-black text-white heading-font tracking-tighter leading-[0.75] mb-12 select-none">ZeroBuild.Ai</h1>
                <p className="text-slate-400 text-2xl md:text-3xl font-medium max-w-3xl mx-auto lg:mx-0 leading-relaxed opacity-80">Enterprise AI Architecture & Visualization Suite.</p>
              </div>
              <div className="w-full lg:w-[520px] space-y-6">
                {[{ role: 'CLIENT', label: 'Client Portal', desc: 'Manage your building & room records', icon: UserIcon }, { role: 'DEVELOPER', label: 'Admin Console', desc: 'Centralized client data access', icon: Briefcase }].map((item) => (
                  <button key={item.role} onClick={() => { setAuthView({ role: item.role as any, mode: 'login' }); handleNewProject(); }} className="group w-full p-10 bg-[#0f172a]/80 backdrop-blur-2xl border border-slate-800 rounded-[3rem] hover:border-indigo-500 transition-all text-left flex items-center gap-10 shadow-2xl active:scale-[0.98]"><div className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-[2rem] flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all"><item.icon size={40} /></div><div><h3 className="text-3xl font-black text-white mb-2 heading-font">{item.label}</h3><p className="text-slate-400 text-sm font-medium opacity-60">{item.desc}</p></div></button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col">
        <Navbar lang={lang} onLangChange={setLang} onHistoryClick={() => setShowHistory(true)} onLogout={handleLogout} isLoggedIn={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 p-12 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setAuthView(null)} className="absolute top-8 left-8 text-slate-500 hover:text-white flex items-center gap-2 font-bold uppercase text-xs tracking-widest"><ChevronRight className="rotate-180" size={16} /> Back</button>
            <div className="mt-8 mb-10 text-center"><h2 className="text-3xl font-black text-white heading-font">{authView.role === 'CLIENT' ? 'Client Access' : 'Admin Access'}</h2></div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder="Email / Username" className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={credentials.username} onChange={e => setCredentials(p => ({ ...p, username: e.target.value }))} />
              <div><input type="password" placeholder="Password" className="w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-5 text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={credentials.password} onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))} /><p className="mt-2 ml-1 text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">Demo: <span className="text-indigo-400/60 lowercase">{authView.role === 'CLIENT' ? 'client@zerobuild.ai / 123456' : 'admin@zerobuild.ai / 789000'}</span></p></div>
              <button type="submit" className="w-full mt-4 py-6 bg-indigo-600 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl active:scale-[0.98]">Access</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isClient = currentUser.role === 'CLIENT';
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <Navbar lang={lang} onLangChange={setLang} onHistoryClick={() => setShowHistory(true)} onLogout={handleLogout} isLoggedIn={true} />
      <div className="flex">
        <aside className="hidden lg:flex w-72 flex-col bg-[#0f172a]/40 border-r border-slate-800 h-[calc(100vh-80px)] p-6 gap-2 sticky top-[80px]">
          {isClient ? (<>
              <button onClick={handleNewProject} className="flex items-center gap-4 w-full p-5 rounded-[1.5rem] bg-indigo-600 text-white shadow-xl hover:bg-indigo-500 transition-all active:scale-95 mb-4">
                <FilePlus size={22} /><span className="font-bold">New Project</span>
              </button>
              <button onClick={() => { setViewMode('dashboard'); setCurrentProject(null); }} className={`flex items-center gap-4 w-full p-5 rounded-[1.5rem] transition-all ${viewMode === 'dashboard' && !currentProject ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
                <LayoutGrid size={22} /><span className="font-bold">Dashboard</span>
              </button>
              <button onClick={() => setViewMode('rooms')} className={`flex items-center gap-4 w-full p-5 rounded-[1.5rem] transition-all ${viewMode === 'rooms' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}>
                <Sofa size={22} /><span className="font-bold">Interior Studio</span>
              </button>
              <button onClick={() => setShowHistory(true)} className={`flex items-center gap-4 w-full p-5 rounded-[1.5rem] transition-all text-slate-400 hover:bg-slate-800/50 hover:text-white`}>
                <Clock size={22} /><span className="font-bold">Vault Registry</span>
              </button>
            </>) : (<><button onClick={() => setViewMode('admin_lookup')} className={`flex items-center gap-4 w-full p-5 rounded-[1.5rem] transition-all ${viewMode === 'admin_lookup' ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}><Search size={22} /><span className="font-bold">Record Lookup</span></button></>)}
        </aside>
        <main className="flex-1 p-6 lg:p-10 overflow-x-hidden min-h-[calc(100vh-80px)]">
          {viewMode === 'dashboard' && isClient && !currentProject ? (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 max-w-7xl mx-auto">
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div className="space-y-2"><h2 className="text-5xl font-black text-white heading-font tracking-tight">Project Registry</h2><p className="text-slate-500 text-xl font-medium">Create your next architectural masterpiece.</p></div>
                <div className="bg-slate-800 px-6 py-4 rounded-2xl border border-slate-700 text-slate-400 font-bold text-xs uppercase tracking-widest flex items-center gap-3"><UserIcon size={16} /> Client ID: <span className="text-indigo-400">{currentUser.id}</span></div>
              </header>
              <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
                   <div className="grid grid-cols-2 gap-3"><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} /><button onClick={() => fileInputRef.current?.click()} className="bg-slate-800 text-white p-4 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 border border-slate-700 transition-all"><Upload size={16} /> Upload Plot</button><button onClick={startCamera} className="bg-slate-800 text-white p-4 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 border border-slate-700 transition-all"><Camera size={16} /> Capture</button></div>
                   <div className="space-y-4">
                      <input type="text" placeholder="Project Title" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 text-sm" value={formData.buildingName} onChange={e => setFormData(p => ({ ...p, buildingName: e.target.value }))} />
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Sq Ft (Area)</label><input type="number" placeholder="0" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-bold" value={formData.totalArea || ''} onChange={e => updateBuildingDimensions('a', Number(e.target.value))} /></div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Length (ft)</label><input type="number" placeholder="0" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-bold" value={formData.length || ''} onChange={e => updateBuildingDimensions('l', Number(e.target.value))} /></div>
                         <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Breadth (ft)</label><input type="number" placeholder="0" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-bold" value={formData.breadth || ''} onChange={e => updateBuildingDimensions('b', Number(e.target.value))} /></div>
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Budget (₹)</label><input type="text" placeholder="Rupees" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none focus:ring-1 focus:ring-indigo-500 text-sm" value={formData.budget} onChange={e => setFormData(p => ({ ...p, budget: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Floors</label><input type="number" min="1" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none text-sm" value={formData.floors} onChange={e => setFormData(p => ({ ...p, floors: Number(e.target.value) }))} /></div>
                         <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Rooms/Floor</label><input type="number" min="1" className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none text-sm" value={formData.roomsPerFloor} onChange={e => setFormData(p => ({ ...p, roomsPerFloor: Number(e.target.value) }))} /></div>
                      </div>
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Building Type</label><select className="w-full bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-white outline-none text-sm" value={formData.buildingType} onChange={e => setFormData(p => ({ ...p, buildingType: e.target.value }))}>{BUILDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                      <div className="space-y-3 pt-2"><label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-2"><Palette size={12} /> Exterior Finish</label><div className="flex flex-wrap gap-2">{COLORS.map(c => (<button key={c.value} onClick={() => setFormData(p => ({ ...p, mainColor: c.value }))} className={`w-8 h-8 rounded-full border-2 transition-all ${formData.mainColor === c.value ? 'border-indigo-500 scale-110 shadow-lg' : 'border-slate-800'}`} style={{ backgroundColor: c.value }} />))}</div></div>
                   </div>
                   <button onClick={generateProject} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 shadow-2xl active:scale-95 disabled:opacity-50 mt-4 transition-all">{isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />} Generate Visuals</button>
                </div>
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group aspect-video min-h-[400px]">{previewImage ? (<div className="w-full h-full relative"><img src={previewImage} className="w-full h-full object-cover" /><button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 bg-red-600 hover:bg-red-500 text-white p-2.5 rounded-xl transition-all shadow-xl z-10"><Trash2 size={18} /></button></div>) : (<div className="space-y-4 py-20 opacity-20 group-hover:opacity-40 transition-opacity"><ImageIcon size={64} className="mx-auto" /><p className="font-black uppercase tracking-[0.4em] text-xs">Site View Pending</p></div>)}</div>
              </div>
            </div>
          ) : viewMode === 'rooms' && isClient ? (
            renderRoomsView()
          ) : viewMode === 'admin_lookup' ? (
            renderAdminLookup()
          ) : (
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 animate-in fade-in slide-in-from-right-8 duration-700">
               <div className="flex-1">
                  <header className="flex justify-between items-center mb-10">
                    <div><h2 className="text-4xl font-black text-white heading-font tracking-tight">Analysis Report</h2><p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1 italic">{currentProject?.buildingName} (Client ID: {currentProject?.clientId})</p></div>
                    <div className="flex gap-3">
                        <button onClick={handleNewProject} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all shadow-lg active:scale-95">
                          <FilePlus size={14} /> New Project
                        </button>
                        <button onClick={() => setViewMode(isClient ? 'dashboard' : 'admin_lookup')} className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all">
                          <ChevronRight className="rotate-180" size={14} /> Back
                        </button>
                    </div>
                  </header>
                  {renderTabContent()}
               </div>
               <aside className="w-full lg:w-80 shrink-0 space-y-4"><div className="grid grid-cols-1 gap-3"><button onClick={() => setActiveTab('visualization')} className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 ${activeTab === 'visualization' ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}><p className={`text-lg font-black heading-font ${activeTab === 'visualization' ? 'text-indigo-400' : 'text-white'}`}>Visualization</p><p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">3D Exterior Render</p></button><button onClick={() => setActiveTab('interior')} className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 ${activeTab === 'interior' ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}><p className={`text-lg font-black heading-font ${activeTab === 'interior' ? 'text-indigo-400' : 'text-white'}`}>Interior Plan</p></button><button onClick={() => setActiveTab('budget')} className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 ${activeTab === 'budget' ? 'bg-indigo-600/10 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}><p className={`text-lg font-black heading-font ${activeTab === 'budget' ? 'text-indigo-400' : 'text-white'}`}>Budget View</p></button></div></aside>
            </div>
          )}
        </main>
      </div>
      <Chatbot currentProject={currentProject} lang={lang} />
      <Footer lang={lang} />
      {isCameraOpen && (<div className="fixed inset-0 z-[1200] bg-black/98 flex flex-col items-center justify-center p-8"><div className="relative w-full max-w-5xl aspect-video bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl flex items-center justify-center border border-white/5"><video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-contain" /><div className={`absolute inset-0 bg-white transition-opacity duration-150 ${isFlashing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} /><div className="absolute inset-x-0 bottom-10 flex justify-center items-center gap-12"><button onClick={stopCamera} className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white backdrop-blur-md border border-white/10"><X size={28} /></button><button onClick={capturePhoto} className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center text-white border-[4px] border-white active:scale-90 transition-all shadow-2xl"><Circle size={40} fill="white" /></button></div></div></div>)}
      {showHistory && (<div className="fixed inset-0 z-[1100] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-6"><div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"><div className="p-8 border-b border-slate-800 flex justify-between items-center"><h3 className="text-3xl font-black text-white heading-font tracking-tight">Vault Registry</h3><button onClick={() => setShowHistory(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[9px] transition-all">Close</button></div><div className="p-8 overflow-y-auto max-h-[60vh] space-y-4">{(isClient ? projects.filter(p => p.clientId === currentUser?.id) : projects).map((p) => (<div key={p.id} className="bg-slate-800/30 p-5 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-slate-800/60 transition-all border border-slate-700/30 hover:border-indigo-500/30" onClick={() => { setCurrentProject(p); setShowHistory(false); setViewMode('analytics'); setShowOriginal(false); }}><div className="flex items-center gap-5"><img src={p.afterImage} className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/5" /><div><p className="text-white font-black text-lg">{p.buildingName}</p><p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{p.id} • {p.date}</p></div></div><button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[9px] shadow-lg transition-all hover:scale-105 active:scale-95">View</button></div>))}</div></div></div>)}
    </div>
  );
};

export default App;
