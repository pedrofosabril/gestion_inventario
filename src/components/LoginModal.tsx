import React, { useState } from 'react';
import { Lock, ShieldCheck, User, X, KeyRound, AlertCircle, ShoppingBag, Wrench, Eye, EyeOff, Info } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, currentUser, logout, users } = useInventory();
  const [selectedUser, setSelectedUser] = useState<string>('ventas');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const success = login(selectedUser, password);
    if (success) {
      setPassword('');
      onClose();
    } else {
      setError(`Contraseña incorrecta. (Claves por defecto: "ventas" para Ventas, "verdu" para Gerencia, "panol" para Pañol)`);
    }
  };

  const handleQuickSelect = (username: string, defaultPass: string) => {
    setSelectedUser(username);
    setPassword(defaultPass);
    setError(null);
  };

  const getUserDescription = (rol: string) => {
    switch (rol) {
      case 'gerencia':
        return 'Acceso ejecutivo total: valorización en ARS/USD, auditoría de precios, fechas de control, edición de stock y KPIs.';
      case 'ventas':
        return 'Consulta exclusiva de Pañol, Cajones/Fluidos, Submicrónicos, Rodamientos y Entrepiso (las demás secciones quedan reservadas para Gerencia). Oculta precios de costo y totales.';
      case 'panolero':
        return 'Gestión de pañol: escaneo con lector físico de código de barras, remitos de salida, recepción de ingresos y control de estantes.';
      default:
        return 'Consulta de inventario.';
    }
  };

  const selectedUserData = users.find(u => u.username === selectedUser);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#f8fcfe] rounded-2xl shadow-2xl border border-[#c4e1f7] w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006bb0] to-[#0088dd] p-5 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 backdrop-blur-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight">Control de Usuarios y Roles</h3>
              <p className="text-xs text-sky-100 font-medium">Verdu y Cía. S.A. - Sistema de Pañol</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current status */}
        <div className="bg-[#f4f9fd] border-b border-[#c4e1f7] px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Sesión activa actualmente:</span>
          <span className={`font-bold px-2.5 py-0.5 rounded-lg text-xs border ${
            currentUser?.rol === 'gerencia'
              ? 'bg-purple-100 text-purple-900 border-purple-200'
              : currentUser?.rol === 'ventas'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                : 'bg-[#d6ecfa] text-[#006bb0] border-[#badbf5]'
          }`}>
            {currentUser?.nombre || 'Sin sesión'} ({currentUser?.rol?.toUpperCase() || 'INVITADO'})
          </span>
        </div>

        {/* Quick Profile Selection Buttons */}
        <div className="px-6 pt-4 pb-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Perfiles Disponibles (1-Clic):
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickSelect('ventas', 'ventas')}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                selectedUser === 'ventas'
                  ? 'border-emerald-500 bg-emerald-50 shadow-xs'
                  : 'border-[#c4e1f7] hover:border-emerald-300 hover:bg-white bg-[#f8fcfe]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Ventas</span>
              </div>
              <span className="text-[10px] text-slate-500">Catálogo / Stock</span>
              <span className="text-[9px] font-mono text-emerald-700 font-semibold mt-0.5">clave: ventas</span>
            </button>

            {users.find(u => u.rol === 'gerencia') ? (
              (() => {
                const g = users.find(u => u.rol === 'gerencia')!;
                return (
                  <button
                    type="button"
                    onClick={() => handleQuickSelect(g.username, g.password || '')}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      selectedUser === g.username
                        ? 'border-[#006bb0] bg-sky-50 shadow-xs'
                        : 'border-[#c4e1f7] hover:border-sky-300 hover:bg-white bg-[#f8fcfe]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#006bb0]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#006bb0] shrink-0" />
                      <span>Gerente</span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate">{g.nombre}</span>
                    <span className="text-[9px] font-mono text-[#006bb0] font-semibold mt-0.5">clave: {g.password || 'verdu'}</span>
                  </button>
                );
              })()
            ) : (
              <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 flex flex-col items-center justify-center text-center">
                <ShieldCheck className="w-4 h-4 text-slate-400 mb-0.5" />
                <span className="text-[10px] font-medium">Sin Gerente</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleQuickSelect('panol', 'panol')}
              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                selectedUser === 'panol'
                  ? 'border-[#006bb0] bg-sky-50 shadow-xs'
                  : 'border-[#c4e1f7] hover:border-sky-300 hover:bg-white bg-[#f8fcfe]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#006bb0]">
                <Wrench className="w-3.5 h-3.5 text-[#006bb0] shrink-0" />
                <span>Marcelo</span>
              </div>
              <span className="text-[10px] text-slate-500">Pañol / Scanner</span>
              <span className="text-[9px] font-mono text-[#006bb0] font-semibold mt-0.5">clave: panol</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-3 flex flex-col gap-4">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#006bb0]" />
              Cuenta seleccionada
            </label>
            <select
              value={selectedUser}
              onChange={e => {
                setSelectedUser(e.target.value);
                setError(null);
              }}
              className="w-full text-xs font-semibold py-2.5 px-3 rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0]"
            >
              {users.map(u => (
                <option key={u.id} value={u.username}>
                  {u.nombre} ({u.rol.toUpperCase()}) - usuario: {u.username}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#006bb0]" />
              Contraseña
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Ingresa la contraseña..."
                className="w-full text-sm py-2.5 pl-3 pr-10 rounded-xl border border-[#b8ddf5] bg-white focus:ring-2 focus:ring-[#006bb0] focus:border-[#006bb0] outline-none font-semibold text-slate-800"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? <Eye className="w-4 h-4 text-[#006bb0]" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Dynamic Role Explanation */}
            <div className="p-2.5 rounded-xl bg-[#eaf4fb] border border-[#c4e1f7] mt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-950">
                <Info className="w-3.5 h-3.5 text-[#006bb0]" />
                <span>Permisos del perfil {selectedUserData?.nombre || selectedUser}:</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {getUserDescription(selectedUserData?.rol || '')}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            {currentUser && currentUser.rol !== 'panolero' && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Sesión
              </button>
            )}
            
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-[#eaf4fb] rounded-xl border border-[#badbf5] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#006bb0] hover:bg-[#005590] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                Ingresar
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
