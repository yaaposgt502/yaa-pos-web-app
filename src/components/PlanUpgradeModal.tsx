import React, { useState } from 'react';
import { PlanDefinition, getAllPlans, normalizePlanId } from '../utils/planLimits';
import { License, User } from '../types';
import * as api from '../api';
import { 
  Check, 
  Sparkles, 
  X, 
  Building2, 
  Users, 
  Package, 
  FileText, 
  Bot, 
  ShieldCheck, 
  ArrowRight,
  Loader2
} from 'lucide-react';

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  currentLicense: License | null;
  onPlanChanged?: (newLicense: License) => void;
}

export default function PlanUpgradeModal({
  isOpen,
  onClose,
  user,
  currentLicense,
  onPlanChanged
}: PlanUpgradeModalProps) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [allPlans, setAllPlans] = useState(() => getAllPlans());

  React.useEffect(() => {
    const handlePlansUpdated = () => {
      setAllPlans(getAllPlans());
    };
    window.addEventListener('yaa_pos_plans_updated', handlePlansUpdated);
    return () => window.removeEventListener('yaa_pos_plans_updated', handlePlansUpdated);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setAllPlans(getAllPlans());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlanId = normalizePlanId(currentLicense?.planType);

  const handleSelectPlan = async (plan: PlanDefinition) => {
    if (!user) return;
    if (plan.id === currentPlanId) return;

    setLoadingPlanId(plan.id);
    setSuccessMessage(null);

    try {
      const updatedLicense = await api.changeUserPlan(user.id, plan.name);
      setSuccessMessage(`¡Plan actualizado con éxito a ${plan.name}! Los límites y permisos han sido actualizados.`);
      if (onPlanChanged) {
        onPlanChanged(updatedLicense);
      }
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      alert('Error al actualizar el plan: ' + (err.message || err));
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F1C3F] via-[#15234E] to-[#1E306E] text-white px-6 sm:px-8 py-6 flex items-start justify-between border-b border-white/10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-blue-400">
                Planes y Suscripciones Yaa POS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-display">
              Elige el plan ideal para tu empresa
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
              Cada plan determina de forma estricta los límites de sucursales, usuarios y funcionalidades disponibles en tu cuenta.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {allPlans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isPro = plan.id === 'profesional';
              const isEnterprise = plan.id === 'empresarial';

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all border ${
                    isCurrent
                      ? 'bg-white border-blue-500 shadow-lg ring-2 ring-blue-500/20'
                      : isPro
                      ? 'bg-white border-emerald-500/80 shadow-md hover:shadow-lg'
                      : 'bg-white border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Badge */}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Plan Actual
                    </div>
                  )}
                  {!isCurrent && isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-3.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Más Popular
                    </div>
                  )}
                  {!isCurrent && isEnterprise && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Ilimitado
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Header */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-lg text-slate-900">{plan.name}</h3>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isPro ? 'bg-emerald-50 text-emerald-700' : isEnterprise ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {plan.badge || 'Activo'}
                        </span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900 tracking-tight font-display">
                          {plan.price}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {plan.period}
                        </span>
                      </div>
                    </div>

                    {/* Hard Resource Limits Summary */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-500">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" /> Sucursales:
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {plan.maxBranches >= 999 ? 'Ilimitadas' : `${plan.maxBranches} máx.`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-500">
                          <Users className="w-3.5 h-3.5 text-blue-600" /> Usuarios:
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {plan.maxUsers >= 999 ? 'Ilimitados' : `${plan.maxUsers} máx.`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-500">
                          <Package className="w-3.5 h-3.5 text-blue-600" /> Productos:
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {plan.maxProducts >= 999999 || plan.maxProducts === Infinity ? 'Ilimitados' : `${plan.maxProducts.toLocaleString()} máx.`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1.5 font-medium text-slate-500">
                          <FileText className="w-3.5 h-3.5 text-blue-600" /> Facturación FEL:
                        </span>
                        <span className={`font-bold ${plan.felAllowed ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {plan.felAllowed ? 'Habilitada' : 'No incluida'}
                        </span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Incluye:
                      </p>
                      <ul className="space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600 leading-snug">
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-6">
                    {isCurrent ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-wider cursor-default flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4 text-blue-600" />
                        <span>Plan Activo</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        disabled={loadingPlanId !== null}
                        className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer ${
                          isPro
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                            : isEnterprise
                            ? 'bg-[#1E88E5] hover:bg-blue-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {loadingPlanId === plan.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Cambiando Plan...</span>
                          </>
                        ) : (
                          <>
                            <span>Elegir Plan {plan.name}</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Guarantee Note */}
          <div className="mt-8 bg-blue-50/60 border border-blue-150 rounded-2xl p-4 flex items-center gap-3 text-blue-900 text-xs font-medium">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <p>
              <strong>Garantía de preservación de datos:</strong> Al actualizar o reducir tu plan, tus sucursales, usuarios e historial existentes nunca se eliminarán. Los nuevos límites se aplicarán a la creación de recursos futuros.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            ¿Tienes dudas sobre los planes corporativos? Contacta a soporte técnico.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
