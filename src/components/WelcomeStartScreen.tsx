import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle,
  ShoppingBag,
  Boxes,
  UserPlus,
  LogIn,
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { UserRole } from '../types';
import { Logo } from './Logo';

export const WelcomeStartScreen: React.FC = () => {
  const { validateLogin, registerUser, users } = useInventory();

  // Mode: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);

  // Register form state
  const [regNombre, setRegNombre] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regRol, setRegRol] = useState<UserRole>('administracion');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);

  // Feedback messages
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Login Submit with strict credential validation
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const result = validateLogin(loginUsername, loginPassword);
    if (!result.success) {
      setError(result.message);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (regPassword !== regConfirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!/[A-Z]/.test(regPassword)) {
      setError('La contraseña debe contener al menos una letra mayúscula (A-Z).');
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±°]/.test(regPassword)) {
      setError('La contraseña debe contener al menos un carácter especial (ej: ! @ # $ % * - _).');
      return;
    }

    const result = registerUser({
      nombre: regNombre,
      username: regUsername,
      rol: regRol,
      password: regPassword,
    });

    if (!result.success) {
      setError(result.message);
    } else {
      setSuccessMsg(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf6fc] flex flex-col items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#0080D0] selection:text-white">
      
      {/* Centered Auth Box */}
      <div className="w-full max-w-[420px] mx-auto bg-white rounded-3xl p-6 sm:p-7 border border-[#c4e1f7] shadow-lg shadow-sky-950/5">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center mb-4">
          <Logo variant="icon" size="xl" className="mb-2" />
          <div className="flex items-baseline gap-1">
            <span className="font-black text-2xl tracking-tight text-[#006bb0]">Verdu</span>
            <span className="font-bold text-lg text-[#006bb0]">y Cía.</span>
          </div>
          <span className="text-[11px] font-bold text-sky-800/70 tracking-wider uppercase mt-0.5">
            PAÑOL E INVENTARIO
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="w-full grid grid-cols-2 p-1 bg-[#eaf4fb] rounded-xl border border-[#cce5f8] mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'login'
                ? 'bg-[#006bb0] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#006bb0]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'register'
                ? 'bg-[#006bb0] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#006bb0]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear Cuenta</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full mb-3.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="w-full mb-3.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================= */}
        {/* LOGIN FORM */}
        {/* ========================================= */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="w-full flex flex-col gap-3.5">
            
            {/* Usuario */}
            <div className="flex flex-col text-left">
              <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                Usuario
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Nombre de usuario"
                className="w-full bg-[#f4f9fd] hover:bg-[#eaf4fb] focus:bg-white text-slate-800 text-sm font-semibold rounded-xl px-3.5 py-2.5 outline-none border border-[#b8ddf5] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 transition-all"
                required
                autoFocus
              />
            </div>

            {/* Contraseña */}
            <div className="flex flex-col text-left">
              <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                Contraseña
              </label>
              <div className="relative w-full">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#f4f9fd] hover:bg-[#eaf4fb] focus:bg-white text-slate-800 text-sm font-semibold rounded-xl pl-3.5 pr-10 py-2.5 outline-none border border-[#b8ddf5] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showLoginPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showLoginPassword ? <Eye className="w-4 h-4 text-[#006bb0]" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full mt-1.5 bg-[#006bb0] hover:bg-[#005590] text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión</span>
            </button>

          </form>
        )}

        {/* ========================================= */}
        {/* REGISTER FORM */}
        {/* ========================================= */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="w-full flex flex-col gap-2.5">
            
            {/* Nombre */}
            <div className="flex flex-col text-left">
              <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nombre y Apellido
              </label>
              <input
                type="text"
                value={regNombre}
                onChange={e => setRegNombre(e.target.value)}
                placeholder="ej: María González"
                className="w-full bg-[#f4f9fd] hover:bg-[#eaf4fb] focus:bg-white text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none border border-[#b8ddf5] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 transition-all"
                required
                autoFocus
              />
            </div>

            {/* Usuario */}
            <div className="flex flex-col text-left">
              <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                Usuario
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="ej: mgonzalez"
                className="w-full bg-[#f4f9fd] hover:bg-[#eaf4fb] focus:bg-white text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none border border-[#b8ddf5] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 transition-all font-mono"
                required
              />
            </div>

            {/* Rol Selection */}
            <div className="flex flex-col text-left">
              <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                Rol
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {/* Administración */}
                <button
                  type="button"
                  onClick={() => setRegRol('administracion')}
                  className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    regRol === 'administracion'
                      ? 'border-[#006bb0] bg-sky-50 text-[#006bb0] font-bold ring-2 ring-[#006bb0]/20'
                      : 'border-[#cce4f7] bg-white text-slate-700 hover:border-[#006bb0] font-medium'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[11px] leading-none">Administración</span>
                </button>

                {/* Pañolero */}
                <button
                  type="button"
                  onClick={() => setRegRol('panolero')}
                  className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    regRol === 'panolero'
                      ? 'border-[#006bb0] bg-sky-50 text-[#006bb0] font-bold ring-2 ring-[#006bb0]/20'
                      : 'border-[#cce4f7] bg-white text-slate-700 hover:border-[#006bb0] font-medium'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span className="text-[11px] leading-none">Pañolero</span>
                </button>

                {/* Ventas */}
                <button
                  type="button"
                  onClick={() => setRegRol('ventas')}
                  className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    regRol === 'ventas'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-bold ring-2 ring-emerald-600/20'
                      : 'border-[#cce4f7] bg-white text-slate-700 hover:border-emerald-600 font-medium'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span className="text-[11px] leading-none">Ventas</span>
                </button>
              </div>
            </div>

            {/* Contraseñas */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col text-left">
                <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres"
                    className="w-full bg-[#f4f9fd] hover:bg-[#eaf4fb] focus:bg-white text-slate-800 text-xs font-semibold rounded-xl pl-2.5 pr-7 py-2 outline-none border border-[#b8ddf5] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={showRegPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showRegPassword ? <Eye className="w-3.5 h-3.5 text-[#006bb0]" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col text-left">
                <label className="text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Confirmar
                </label>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  value={regConfirmPassword}
                  onChange={e => setRegConfirmPassword(e.target.value)}
                  placeholder="Repetir clave"
                  className="w-full bg-[#f4f9fd] hover:bg-[#eaf4fb] focus:bg-white text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-2 outline-none border border-[#b8ddf5] focus:border-[#006bb0] focus:ring-2 focus:ring-[#006bb0]/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Requirements Guide */}
            <div className="p-2 bg-sky-50/70 border border-sky-100 rounded-xl text-[10px] text-slate-600 flex flex-col gap-0.5">
              <span className="font-bold text-sky-950">Requisitos de contraseña:</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={regPassword.length >= 8 ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {regPassword.length >= 8 ? '✓' : '•'} Mínimo 8 carácteres
                </span>
                <span className={/[A-Z]/.test(regPassword) ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {/[A-Z]/.test(regPassword) ? '✓' : '•'} 1 Mayúscula
                </span>
                <span className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±°]/.test(regPassword) ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±°]/.test(regPassword) ? '✓' : '•'} 1 Carácter especial
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full mt-1 bg-[#006bb0] hover:bg-[#005590] text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Crear Cuenta</span>
            </button>

          </form>
        )}

      </div>

    </div>
  );
};
