'use client';

// ---------------------------------------------------------------------------
// Portal types (LobeChat-inspired)
// ---------------------------------------------------------------------------

export type PortalViewType = 'artifact' | 'terminal' | 'suggestion' | 'home';

export interface PortalArtifact {
  messageId: string;
  identifier: string;
  title: string;
  type: string;
  language?: string;
  content: string;
}

export interface PortalViewData {
  type: PortalViewType;
  artifact?: PortalArtifact;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface PortalSliceState {
  portalStack: PortalViewData[];
  showPortal: boolean;
  portalDisplayMode: 'code' | 'preview';
}

// ---------------------------------------------------------------------------
// Actions interface
// ---------------------------------------------------------------------------

export interface PortalSliceActions {
  pushPortalView: (view: PortalViewData) => void;
  popPortalView: () => void;
  replacePortalView: (view: PortalViewData) => void;
  clearPortalStack: () => void;
  openArtifact: (artifact: PortalArtifact) => void;
  closePortal: () => void;
  togglePortal: () => void;
  setPortalDisplayMode: (mode: 'code' | 'preview') => void;
  goBack: () => void;
}

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createPortalSlice = (set: any, get: any) => ({
  // --- initial state ---
  portalStack: [] as PortalViewData[],
  showPortal: false,
  portalDisplayMode: 'preview' as 'code' | 'preview',

  // --- actions ---

  pushPortalView: (view: PortalViewData) =>
    set((s: any) => {
      const stack = s.portalStack as PortalViewData[];
      // Smart duplicate prevention: if top of stack has same type, replace
      if (stack.length > 0 && stack[stack.length - 1].type === view.type) {
        return {
          portalStack: [...stack.slice(0, -1), view],
          showPortal: true,
        };
      }
      return {
        portalStack: [...stack, view],
        showPortal: true,
      };
    }),

  popPortalView: () =>
    set((s: any) => {
      const stack = s.portalStack as PortalViewData[];
      if (stack.length <= 1) {
        return { portalStack: [], showPortal: false };
      }
      return { portalStack: stack.slice(0, -1) };
    }),

  replacePortalView: (view: PortalViewData) =>
    set((s: any) => {
      const stack = s.portalStack as PortalViewData[];
      if (stack.length === 0) {
        return { portalStack: [view], showPortal: true };
      }
      return {
        portalStack: [...stack.slice(0, -1), view],
        showPortal: true,
      };
    }),

  clearPortalStack: () => set({ portalStack: [], showPortal: false }),

  openArtifact: (artifact: PortalArtifact) =>
    set((s: any) => {
      const view: PortalViewData = { type: 'artifact', artifact };
      const stack = s.portalStack as PortalViewData[];
      // Smart duplicate prevention: if top is already an artifact, replace
      if (
        stack.length > 0 &&
        stack[stack.length - 1].type === 'artifact'
      ) {
        return {
          portalStack: [...stack.slice(0, -1), view],
          showPortal: true,
        };
      }
      return {
        portalStack: [...stack, view],
        showPortal: true,
      };
    }),

  closePortal: () => set({ showPortal: false }),

  togglePortal: () => set((s: any) => ({ showPortal: !s.showPortal })),

  setPortalDisplayMode: (mode: 'code' | 'preview') =>
    set({ portalDisplayMode: mode }),

  goBack: () =>
    set((s: any) => {
      const stack = s.portalStack as PortalViewData[];
      if (stack.length <= 1) {
        return { portalStack: [], showPortal: false };
      }
      return { portalStack: stack.slice(0, -1) };
    }),
});
