import { registerVuloPilotRoute } from './routeRegistry';

import Dashboard from './pages/Dashboard/Dashboard';
import Performance from './pages/Performance/Performance';
import SeoVisibility from './pages/GEO/SeoVisibility';
import Commerce from './pages/Commerce/Commerce';
import Automations from './pages/Automations/Automations';
import Reports from './pages/Reports/Reports';
import AIAssistant from './pages/AIAssistant/AIAssistant';
import Settings from './pages/Settings/Settings';
import Security from './pages/Security/Security';
import SiteHealth from './pages/SiteHealth/SiteHealth';
import Accessibility from './pages/Accessibility/Accessibility';
import Content from './pages/Content/Content';

registerVuloPilotRoute({ tab: 'dashboard', component: Dashboard });
registerVuloPilotRoute({ tab: 'performance', component: Performance });
registerVuloPilotRoute({ tab: 'seo-visibility', component: SeoVisibility });
registerVuloPilotRoute({ tab: 'commerce', component: Commerce });
registerVuloPilotRoute({ tab: 'automations', component: Automations });
registerVuloPilotRoute({ tab: 'reports', component: Reports });
registerVuloPilotRoute({ tab: 'ai-assistant', component: AIAssistant });
// No standalone `tab: 'modules'` route any more - the real Modules UI
// moved to Settings → Modules (`tab=settings&subtab=modules`, see
// components/Settings/Modules.ts's own docblock); every real deep-link
// to it now points there directly (Popup.tsx/AiCopilotGuard.tsx/
// GettingStartedCard.tsx), so the old standalone page
// (components/Modules/Modules.tsx) has no real caller left - removed
// per direct instruction rather than kept reachable-but-unlinked.
registerVuloPilotRoute({ tab: 'settings', component: Settings });
registerVuloPilotRoute({ tab: 'security', component: Security });
registerVuloPilotRoute({ tab: 'site-health', component: SiteHealth });
registerVuloPilotRoute({ tab: 'accessibility', component: Accessibility });
registerVuloPilotRoute({ tab: 'content', component: Content });
