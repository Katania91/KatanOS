import { User, ModuleId, WidgetId, DashboardLayout, WidgetConfig } from '../types';
import { t, Language } from './translations';
import {
  LayoutDashboard,
  Calendar,
  Users,
  CheckSquare,
  BookOpen,
  Activity,
  Wallet,
  Library,
  Lock,
  Gamepad2,
  LucideIcon,
} from 'lucide-react';

export interface ModuleDefinition {
  id: ModuleId;
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  routes: string[];
  widgets: WidgetId[];
  dependencies: ModuleId[];
  defaultEnabled: boolean;
  canDisable: boolean;
}

export interface ModuleState extends ModuleDefinition {
  enabled: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const MODULE_REGISTRY: Record<ModuleId, ModuleDefinition> = {
  calendar: {
    id: 'calendar',
    labelKey: 'agenda',
    descriptionKey: 'moduleDescCalendar',
    icon: Calendar,
    routes: ['agenda'],
    widgets: ['nextEvent', 'todayEvents', 'weather'],
    dependencies: [],
    defaultEnabled: true,
    canDisable: false, // Core module
  },
  contacts: {
    id: 'contacts',
    labelKey: 'contacts',
    descriptionKey: 'moduleDescContacts',
    icon: Users,
    routes: ['contacts'],
    widgets: ['favorites'],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  todo: {
    id: 'todo',
    labelKey: 'todo',
    descriptionKey: 'moduleDescTodo',
    icon: CheckSquare,
    routes: ['todo'],
    widgets: [],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  journal: {
    id: 'journal',
    labelKey: 'journal',
    descriptionKey: 'moduleDescJournal',
    icon: BookOpen,
    routes: ['journal'],
    widgets: [],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  habits: {
    id: 'habits',
    labelKey: 'habits',
    descriptionKey: 'moduleDescHabits',
    icon: Activity,
    routes: ['habits'],
    widgets: [],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  finance: {
    id: 'finance',
    labelKey: 'finance',
    descriptionKey: 'moduleDescFinance',
    icon: Wallet,
    routes: ['finance'],
    widgets: ['financeOverview'],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  bookshelf: {
    id: 'bookshelf',
    labelKey: 'bookshelf',
    descriptionKey: 'moduleDescBookshelf',
    icon: Library,
    routes: ['bookshelf'],
    widgets: [],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  vault: {
    id: 'vault',
    labelKey: 'vault',
    descriptionKey: 'moduleDescVault',
    icon: Lock,
    routes: ['vault'],
    widgets: [],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
  games: {
    id: 'games',
    labelKey: 'games',
    descriptionKey: 'moduleDescGames',
    icon: Gamepad2,
    routes: ['games'],
    widgets: [],
    dependencies: [],
    defaultEnabled: true,
    canDisable: true,
  },
};

// Order for navigation sidebar
export const MODULE_NAV_ORDER: ModuleId[] = [
  'calendar',
  'contacts',
  'todo',
  'journal',
  'habits',
  'finance',
  'bookshelf',
  'vault',
  'games',
];

// Core widgets that are always available (not tied to any module)
const CORE_WIDGETS: WidgetId[] = ['clock', 'quote', 'pomodoro'];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  clock: 'widgetClock',
  weather: 'widgetWeather',
  quote: 'widgetQuote',
  nextEvent: 'widgetNextEvent',
  todayEvents: 'widgetTodayEvents',
  favorites: 'widgetFavorites',
  financeOverview: 'widgetFinance',
  pomodoro: 'widgetPomodoro',
};

export const modulesService = {
  /**
   * Get all modules with their current state for a user
   */
  getModulesForUser(user: User): ModuleState[] {
    return MODULE_NAV_ORDER.map((moduleId) => {
      const mod = MODULE_REGISTRY[moduleId];
      return {
        ...mod,
        enabled: user.modulesConfig?.[mod.id] ?? mod.defaultEnabled,
      };
    });
  },

  /**
   * Check if a specific module is enabled
   */
  isModuleEnabled(user: User | null, moduleId: ModuleId): boolean {
    if (!user) return false;
    const config = user.modulesConfig || {};
    const mod = MODULE_REGISTRY[moduleId];
    return config[moduleId] ?? mod?.defaultEnabled ?? false;
  },

  /**
   * Get navigation items filtered by enabled modules
   * Dashboard is always included as it's the home page
   */
  getNavItems(user: User, lang: Language): NavItem[] {
    // Dashboard is always first and always visible
    const dashboardItem: NavItem = {
      id: 'dashboard',
      label: t('dashboard', lang),
      icon: LayoutDashboard,
    };
    
    const moduleItems = MODULE_NAV_ORDER.filter((moduleId) => this.isModuleEnabled(user, moduleId)).map((moduleId) => {
      const mod = MODULE_REGISTRY[moduleId];
      return {
        id: mod.routes[0],
        label: t(mod.labelKey, lang),
        icon: mod.icon,
      };
    });
    
    return [dashboardItem, ...moduleItems];
  },

  /**
   * Check if a route is accessible based on enabled modules
   */
  isRouteAccessible(user: User | null, route: string): boolean {
    if (!user) return false;
    // Dashboard is always accessible
    if (route === 'dashboard') return true;

    // Find which module owns this route
    for (const moduleId of MODULE_NAV_ORDER) {
      const mod = MODULE_REGISTRY[moduleId];
      if (mod.routes.includes(route)) {
        return this.isModuleEnabled(user, moduleId);
      }
    }

    // Unknown routes are accessible by default
    return true;
  },

  /**
   * Get available widgets based on enabled modules
   */
  getAvailableWidgets(user: User): WidgetId[] {
    const widgets: WidgetId[] = [...CORE_WIDGETS];

    MODULE_NAV_ORDER.forEach((moduleId) => {
      if (this.isModuleEnabled(user, moduleId)) {
        const mod = MODULE_REGISTRY[moduleId];
        widgets.push(...mod.widgets);
      }
    });

    return widgets;
  },

  /**
   * Get default dashboard layout
   */
  getDefaultLayout(): DashboardLayout {
    return {
      version: '1.0',
      widgets: [
        { id: 'clock', enabled: true, order: 0 },
        { id: 'weather', enabled: true, order: 1 },
        { id: 'quote', enabled: true, order: 2 },
        { id: 'nextEvent', enabled: true, order: 3 },
        { id: 'todayEvents', enabled: true, order: 4 },
        { id: 'favorites', enabled: true, order: 5 },
        { id: 'financeOverview', enabled: true, order: 6 },
        { id: 'pomodoro', enabled: true, order: 7 },
      ],
    };
  },

  /**
   * Validate and clean up dashboard layout when modules change
   */
  sanitizeDashboardLayout(user: User): DashboardLayout {
    const available = new Set(this.getAvailableWidgets(user));
    const layout = user.dashboardLayout || this.getDefaultLayout();
    const defaultLayout = this.getDefaultLayout();

    // Filter out widgets that are no longer available
    const existingWidgets = layout.widgets.filter((w) => available.has(w.id));
    const existingIds = new Set(existingWidgets.map((w) => w.id));

    // Add any new available widgets that aren't in the layout
    const newWidgets: WidgetConfig[] = [];
    available.forEach((widgetId) => {
      if (!existingIds.has(widgetId)) {
        const defaultWidget = defaultLayout.widgets.find((w) => w.id === widgetId);
        newWidgets.push({
          id: widgetId as WidgetId,
          enabled: defaultWidget?.enabled ?? true,
          order: defaultWidget?.order ?? existingWidgets.length + newWidgets.length,
        });
      }
    });

    return {
      ...layout,
      widgets: [...existingWidgets, ...newWidgets].sort((a, b) => a.order - b.order),
    };
  },

  /**
   * Update widget order in layout
   */
  reorderWidgets(layout: DashboardLayout, widgetId: WidgetId, newOrder: number): DashboardLayout {
    const widgets = [...layout.widgets];
    const widgetIndex = widgets.findIndex((w) => w.id === widgetId);
    if (widgetIndex === -1) return layout;

    const [widget] = widgets.splice(widgetIndex, 1);
    widgets.splice(newOrder, 0, widget);

    // Reassign order values
    return {
      ...layout,
      widgets: widgets.map((w, i) => ({ ...w, order: i })),
    };
  },

  /**
   * Toggle widget visibility
   */
  toggleWidget(layout: DashboardLayout, widgetId: WidgetId): DashboardLayout {
    return {
      ...layout,
      widgets: layout.widgets.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w)),
    };
  },
};

export default modulesService;
