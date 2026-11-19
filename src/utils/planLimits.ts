export interface PlanDefinition {
  id: string;
  name: string;
  price: string;
  period: string;
  status: string;
  badge?: string;
  maxBranches: number;
  maxUsers: number;
  maxProducts: number;
  felAllowed: boolean;
  aiAssistantAllowed: boolean;
  multiBranchAllowed: boolean;
  features: string[];
}

export const SYSTEM_PLANS: Record<'basico' | 'profesional' | 'empresarial', PlanDefinition> = {
  basico: {
    id: 'basico',
    name: 'Básico',
    price: 'Q 199.00',
    period: '/mes',
    status: 'Activo',
    badge: 'Activo',
    maxBranches: 1,
    maxUsers: 3,
    maxProducts: 999999,
    felAllowed: false,
    aiAssistantAllowed: false,
    multiBranchAllowed: false,
    features: [
      '1 sucursal o punto de venta',
      'Hasta 3 usuarios (operadores y admin)',
      'Productos ilimitados en catálogo',
      'Control de ventas y caja'
    ]
  },
  profesional: {
    id: 'profesional',
    name: 'Profesional',
    price: 'Q 349.00',
    period: '/mes',
    status: 'Activo',
    badge: 'Recomendado',
    maxBranches: 3,
    maxUsers: 5,
    maxProducts: 999999,
    felAllowed: true,
    aiAssistantAllowed: true,
    multiBranchAllowed: true,
    features: [
      'Hasta 3 sucursales o puntos de venta',
      'Hasta 5 usuarios (operadores y admin)',
      'Productos ilimitados en catálogo',
      'Facturación electrónica FEL (próximamente)',
      'Gestión de compras y proveedores'
    ]
  },
  empresarial: {
    id: 'empresarial',
    name: 'Empresarial',
    price: 'Q 599.00',
    period: '/mes',
    status: 'Activo',
    badge: 'Ilimitado',
    maxBranches: 999,
    maxUsers: 999,
    maxProducts: 999999,
    felAllowed: true,
    aiAssistantAllowed: true,
    multiBranchAllowed: true,
    features: [
      'Sucursales y puntos de venta ilimitados',
      'Usuarios y operadores ilimitados',
      'Productos y ventas ilimitadas',
      'Traslados de stock y FEL (próximamente)',
      'Soporte prioritario 24/7'
    ]
  }
};

/**
 * Normalizes any plan string (including legacy license plans) to one of the 3 plan keys:
 * 'basico' | 'profesional' | 'empresarial'
 */
export function normalizePlanId(planNameOrType?: string | null): 'basico' | 'profesional' | 'empresarial' {
  if (!planNameOrType) return 'basico';
  const clean = planNameOrType.toLowerCase().trim();

  if (clean.includes('empresarial') || clean.includes('avanzado') || clean.includes('enterprise')) {
    return 'empresarial';
  }
  if (clean.includes('profesional') || clean.includes('anual') || clean.includes('premium') || clean.includes('pro')) {
    return 'profesional';
  }
  if (clean.includes('básico') || clean.includes('basico') || clean.includes('demo') || clean.includes('mensual') || clean.includes('gratuito')) {
    return 'basico';
  }

  return 'basico';
}

/**
 * Saves plans list to localStorage and triggers event for real-time reactivity
 */
export function savePlans(plans: PlanDefinition[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('yaa_pos_plans', JSON.stringify(plans));
    window.dispatchEvent(new Event('yaa_pos_plans_updated'));
  }
}

/**
 * Returns the full plan definition for a given plan name or license planType
 */
export function getPlanDefinition(planNameOrType?: string | null): PlanDefinition {
  const allPlans = getAllPlans();
  if (planNameOrType) {
    const clean = planNameOrType.toLowerCase().trim();
    const exact = allPlans.find(p => p.name.toLowerCase() === clean || p.id.toLowerCase() === clean);
    if (exact) return exact;

    const contains = allPlans.find(p => clean.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(clean));
    if (contains) return contains;
  }

  const planId = normalizePlanId(planNameOrType);
  const match = allPlans.find(p => normalizePlanId(p.id) === planId || normalizePlanId(p.name) === planId);
  return match || allPlans[0] || SYSTEM_PLANS[planId];
}

export function getAllPlans(): PlanDefinition[] {
  const defaults: PlanDefinition[] = [SYSTEM_PLANS.basico, SYSTEM_PLANS.profesional, SYSTEM_PLANS.empresarial];
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('yaa_pos_plans');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((p: any) => {
            const planKey = normalizePlanId(p.id || p.name);
            const base = SYSTEM_PLANS[planKey] || SYSTEM_PLANS.basico;
            const sanitizedFeatures = Array.isArray(p.features) && p.features.length > 0 
              ? p.features.map((f: string) => f.includes('250 productos') ? 'Productos ilimitados en catálogo' : f)
              : base.features;

            return {
              id: p.id || planKey,
              name: p.name || base.name,
              price: typeof p.price === 'string' ? p.price.replace('S/', 'Q').replace('PEN', 'GTQ') : (p.price || base.price),
              period: p.period || base.period,
              status: p.status || base.status,
              badge: p.badge || (planKey === 'profesional' ? 'Recomendado' : planKey === 'empresarial' ? 'Ilimitado' : 'Activo'),
              maxBranches: typeof p.maxBranches === 'number' ? p.maxBranches : (planKey === 'basico' ? 1 : planKey === 'profesional' ? 3 : 999),
              maxUsers: typeof p.maxUsers === 'number' ? p.maxUsers : (planKey === 'basico' ? 3 : planKey === 'profesional' ? 5 : 999),
              maxProducts: 999999, // Todos los planes están configurados a productos ilimitados
              felAllowed: typeof p.felAllowed === 'boolean' ? p.felAllowed : (planKey !== 'basico'),
              aiAssistantAllowed: typeof p.aiAssistantAllowed === 'boolean' ? p.aiAssistantAllowed : (planKey !== 'basico'),
              multiBranchAllowed: typeof p.multiBranchAllowed === 'boolean' ? p.multiBranchAllowed : (planKey !== 'basico'),
              features: sanitizedFeatures
            };
          });
          // Ensure upgraded unlimited limits are written back to localStorage
          localStorage.setItem('yaa_pos_plans', JSON.stringify(mapped));
          return mapped;
        }
      } else {
        localStorage.setItem('yaa_pos_plans', JSON.stringify(defaults));
      }
    } catch {
      // Fallback
    }
  }

  return defaults;
}

/**
 * Check if the company can create a new branch
 */
export function checkBranchLimit(currentCount: number, planType?: string | null): {
  allowed: boolean;
  max: number;
  current: number;
  message?: string;
} {
  const plan = getPlanDefinition(planType);
  const max = plan.maxBranches;
  const allowed = currentCount < max;

  return {
    allowed,
    max,
    current: currentCount,
    message: allowed
      ? undefined
      : `Has alcanzado el límite de ${max} sucursal(es) de tu plan ${plan.name}. Para agregar más sucursales, actualiza tu plan.`
  };
}

/**
 * Check if the company can create a new user / operator
 */
export function checkUserLimit(currentCount: number, planType?: string | null): {
  allowed: boolean;
  max: number;
  current: number;
  message?: string;
} {
  const plan = getPlanDefinition(planType);
  const max = plan.maxUsers;
  const allowed = currentCount < max;

  return {
    allowed,
    max,
    current: currentCount,
    message: allowed
      ? undefined
      : `Has alcanzado el límite de ${max} usuarios de tu plan ${plan.name}. Para agregar más usuarios, actualiza tu plan.`
  };
}

/**
 * Check if the company can add more products to inventory
 * Configurado a productos ilimitados en todos los planes.
 */
export function checkProductLimit(currentCount: number, _planType?: string | null): {
  allowed: boolean;
  max: number;
  current: number;
  message?: string;
} {
  return {
    allowed: true,
    max: 999999,
    current: currentCount,
    message: undefined
  };
}

/**
 * Check if a specific module/feature is included in the plan
 */
export function checkFeatureAllowed(
  feature: 'fel' | 'aiAssistant' | 'multiBranch',
  planType?: string | null
): {
  allowed: boolean;
  message?: string;
} {
  const plan = getPlanDefinition(planType);

  if (feature === 'fel') {
    return {
      allowed: plan.felAllowed,
      message: plan.felAllowed
        ? undefined
        : `La Facturación Electrónica (FEL) no está incluida en tu plan ${plan.name}. Actualiza al Plan Profesional o Empresarial para emitir comprobantes SAT.`
    };
  }

  if (feature === 'aiAssistant') {
    return {
      allowed: plan.aiAssistantAllowed,
      message: plan.aiAssistantAllowed
        ? undefined
        : `El Asistente de Inteligencia Artificial está disponible a partir del Plan Profesional. Actualiza tu plan para desbloquear el análisis inteligente.`
    };
  }

  if (feature === 'multiBranch') {
    return {
      allowed: plan.multiBranchAllowed,
      message: plan.multiBranchAllowed
        ? undefined
        : `La gestión de múltiples sucursales requiere el Plan Profesional o Empresarial. Tu plan ${plan.name} permite 1 sucursal.`
    };
  }

  return { allowed: true };
}
