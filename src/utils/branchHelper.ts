import { Branch, User, AppConfig } from '../types';

export const defaultBranchesSeed: Branch[] = [];

export function getSystemBranches(config?: AppConfig): Branch[] {
  if (config?.branches) {
    return config.branches;
  }
  return defaultBranchesSeed;
}

export function getUserAllowedBranches(user?: User | null): string[] {
  if (!user?.isOperator) return [];
  if (user.branches && user.branches.length > 0) return user.branches;
  if (user.branch && user.branch !== 'Todas') {
    return user.branch.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export function getOperationalBranches(config?: AppConfig, user?: User | null): Branch[] {
  const branches = getSystemBranches(config);
  const allowed = getUserAllowedBranches(user);

  if (user?.isOperator && allowed.length > 0) {
    const matched = branches.filter(b =>
      allowed.some(name =>
        name.toLowerCase().trim() === b.name.toLowerCase().trim() ||
        name.toLowerCase().trim() === b.code.toLowerCase().trim() ||
        name.toLowerCase().trim() === b.id.toLowerCase().trim()
      )
    );
    const missing = allowed.filter(name =>
      !matched.some(b =>
        b.name.toLowerCase().trim() === name.toLowerCase().trim() ||
        b.code.toLowerCase().trim() === name.toLowerCase().trim() ||
        b.id.toLowerCase().trim() === name.toLowerCase().trim()
      )
    );
    const synthesized: Branch[] = missing.map((name, idx) => ({
      id: `branch-allowed-${idx}`,
      name,
      code: `SUC-${String(matched.length + idx + 1).padStart(2, '0')}`,
      address: 'Sede autorizada para operaciones',
      city: 'Guatemala',
      isActive: true,
      isMain: matched.length === 0 && idx === 0
    }));
    const combined = [...matched, ...synthesized];
    if (combined.length > 0) return combined;
  }

  return branches;
}

export function resolveBranch(config?: AppConfig, branchIdOrName?: string, user?: User | null): Branch | undefined {
  if (!branchIdOrName) return undefined;
  const operational = getOperationalBranches(config, user);
  const needle = branchIdOrName.toLowerCase().trim();
  return operational.find(b =>
    b.id.toLowerCase().trim() === needle ||
    b.name.toLowerCase().trim() === needle ||
    b.code.toLowerCase().trim() === needle
  );
}

export function getActiveBranch(config?: AppConfig, user?: User | null): Branch | undefined {
  const operational = getOperationalBranches(config, user);

  if (config?.activeBranchId) {
    const found = operational.find(b =>
      b.id === config.activeBranchId ||
      b.name.toLowerCase().trim() === config.activeBranchId.toLowerCase().trim() ||
      b.code.toLowerCase().trim() === config.activeBranchId.toLowerCase().trim()
    );
    if (found) return found;
  }

  const main = operational.find(b => b.isMain);
  return main || operational[0] || undefined;
}

/**
 * Checks whether a movement (sale, shift, expense, purchase) belongs to a branch.
 * If item has no branch recorded (legacy), it maps to the primary/central branch.
 */
export function isItemInBranch(
  itemBranch?: string, 
  targetBranchNameOrCode?: string, 
  allBranches?: Branch[]
): boolean {
  if (!targetBranchNameOrCode || targetBranchNameOrCode === 'Todas' || !allBranches || allBranches.length === 0) return true;
  
  const target = targetBranchNameOrCode.toLowerCase().trim();

  // If item has no branch set (legacy item before multi-branch setup)
  if (!itemBranch || !itemBranch.trim()) {
    const mainBranch = allBranches?.find(b => b.isMain) || allBranches?.[0];
    if (!mainBranch) return true;
    const mainName = (mainBranch.name || '').toLowerCase().trim();
    const mainCode = (mainBranch.code || '').toLowerCase().trim();
    return target === mainName || target === mainCode || (mainName && (target.includes(mainName) || mainName.includes(target)));
  }

  const itemLower = itemBranch.toLowerCase().trim();

  // Direct exact match
  if (itemLower === target) return true;

  // Check if matching code or name via allBranches lookup
  if (allBranches && allBranches.length > 0) {
    const targetBranch = allBranches.find(b => 
      b.name.toLowerCase().trim() === target || 
      b.code.toLowerCase().trim() === target ||
      b.id.toLowerCase().trim() === target
    );
    if (targetBranch) {
      if (itemLower === targetBranch.name.toLowerCase().trim()) return true;
      if (itemLower === targetBranch.code.toLowerCase().trim()) return true;
      if (itemLower === targetBranch.id.toLowerCase().trim()) return true;
    }

    const itemBranchObj = allBranches.find(b => 
      b.name.toLowerCase().trim() === itemLower || 
      b.code.toLowerCase().trim() === itemLower ||
      b.id.toLowerCase().trim() === itemLower
    );
    if (itemBranchObj) {
      if (target === itemBranchObj.name.toLowerCase().trim()) return true;
      if (target === itemBranchObj.code.toLowerCase().trim()) return true;
      if (target === itemBranchObj.id.toLowerCase().trim()) return true;
    }
  }

  return false;
}
