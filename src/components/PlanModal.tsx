import React, { useState, useEffect } from 'react';
import { Sparkles, Check, Building2, Users, Package, ShieldCheck, ArrowRight, X, AlertCircle } from 'lucide-react';
import { License } from '../types';
import { getAllPlans, getPlanDefinition, normalizePlanId } from '../utils/planLimits';
import * as api from '../api';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userLicense?: License | null;
  currentBranchesCount: number;
  currentUsersCount: number;
  currentProductsCount: number;
  onPlanUpdated: (newLicense: License) => void;
}

export default function PlanModal({
  isOpen,
  onClose,
  userId,
  userLicense,
  currentBranchesCount,
  currentUsersCount,
  currentProductsCount,
  onPlanUpdated
}: PlanModalProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [availablePlans, setAvailablePlans] = useState(() => getAllPlans());

  useEffect(() => {
    const handlePlansUpdated = () => {
      setAvailablePlans(getAllPlans());
    };
    window.addEventListener('yaa_pos_plans_updated', handlePlansUpdated);
    return () => window.removeEventListener('yaa_pos_plans_updated', handlePlansUpdated);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAvailablePlans(getAllPlans());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlan = getPlanDefinition(userLicense?.planType);
  const currentPlanKey = normalizePlanId(userLicense?.planType);

  const handleSelectPlan = async (planKey: string) => {
    const targetPlan = getPlanDefinition(planKey);
    if (targetPlan.id === currentPlanKey || targetPlan.name.toLowerCase() === (userLicense?.planType || '').toLowerCase()) {
      return; // Already on this plan
    }

    setIsChanging(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatedLicense = await api.changeUserPlan(userId, targetPlan.name);
      onPlanUpdated(updatedLicense);
      setSuccessMsg(`✓ Plan cambiado exitosamente a "${targetPlan.name}". Los nuevos límites y permisos ya están activos.`);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error changing plan:', err);
      setErrorMsg(err.message || 'Error al actualizar el plan.');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 text-slate-800 flex flex-col max-h-[92dvh] my-auto">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">Planes de Suscripción</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Plan Actual: {currentPlan.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Seleccione el plan que mejor se adapte al volumen y necesidades de su negocio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Consumption Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Consumo actual:</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            {/* Sucursales */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${
              currentBranchesCount >= currentPlan.maxBranches
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200'
            }`}>
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Sucursales: <strong>{currentBranchesCount}</strong> de {currentPlan.maxBranches === 999 ? 'Ilimitadas' : currentPlan.maxBranches}</span>
            </span>

            {/* Usuarios */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${
              currentUsersCount >= currentPlan.maxUsers
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200'
            }`}>
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Usuarios: <strong>{currentUsersCount}</strong> de {currentPlan.maxUsers === 999 ? 'Ilimitados' : currentPlan.maxUsers}</span>
            </span>

            {/* Productos */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-white text-slate-700 border border-slate-200">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>Productos: <strong>{currentProductsCount}</strong> de {currentPlan.maxProducts >= 999999 || currentPlan.maxProducts === Infinity ? 'Ilimitados' : currentPlan.maxProducts}</span>
            </span>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {availablePlans.map((plan) => {
              const isCurrent = 
                plan.id === currentPlanKey || 
                plan.name.toLowerCase() === (userLicense?.planType || '').toLowerCase() ||
                (currentPlan && currentPlan.name.toLowerCase() === plan.name.toLowerCase());
              const isHighlight = plan.id === 'profesional' || plan.badge?.toLowerCase().includes('popular') || plan.badge?.toLowerCase().includes('recomendado');

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all relative ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20 shadow-md'
                      : isHighlight
                      ? 'border-indigo-300 bg-white hover:border-indigo-400 shadow-sm hover:shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isHighlight
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {isCurrent ? 'Plan Activo' : (plan.badge || 'Disponible')}
                    </span>
                    {plan.felAllowed && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> FEL (próximamente)
                      </span>
                    )}
                  </div>

                  {/* Plan Name & Price */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{plan.name}</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">{plan.price}</span>
                      <span className="text-xs font-semibold text-slate-500">{plan.period}</span>
                    </div>

                    {/* Resources Summary */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-blue-500" /> Sucursales:
                        </span>
                        <strong className="text-slate-900 font-extrabold">
                          {plan.maxBranches === 999 ? 'Ilimitadas' : `Hasta ${plan.maxBranches}`}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                          <Users className="w-3.5 h-3.5 text-purple-500" /> Usuarios:
                        </span>
                        <strong className="text-slate-900 font-extrabold">
                          {plan.maxUsers === 999 ? 'Ilimitados' : `Hasta ${plan.maxUsers}`}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                          <Package className="w-3.5 h-3.5 text-amber-500" /> Catálogo:
                        </span>
                        <strong className="text-slate-900 font-extrabold">
                          {plan.maxProducts >= 999999 || plan.maxProducts === Infinity ? 'Ilimitados' : `${plan.maxProducts} productos`}
                        </strong>
                      </div>
                    </div>

                    {/* Features checklist */}
                    <ul className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="mt-6 pt-3 border-t border-slate-100">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-default border border-slate-200"
                      >
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Plan Actual Contratado</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isChanging}
                        onClick={() => handleSelectPlan(plan.id)}
                        className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                          isHighlight
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <span>{isChanging ? 'Actualizando...' : 'Seleccionar este Plan'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info note */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 text-xs text-slate-500">
          <p>
            Al cambiar o reducir de plan, sus datos y registros se conservan intactos. Las funciones y límites se ajustan automáticamente a la nueva suscripción.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer self-end sm:self-auto shrink-0"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
