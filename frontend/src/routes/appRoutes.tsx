
import { RouteType } from "./config";

import { IconApps, IconArticle, IconCellSignal5, IconChecklist, IconHierarchy2, IconHome, IconUserCog, IconUserSquareRounded } from '@tabler/icons-react';
import { IconCoin } from '@tabler/icons-react';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { IconLayoutDashboard } from '@tabler/icons-react';
import { IconClipboardData } from '@tabler/icons-react';
import { IconSettings } from '@tabler/icons-react';
import { IconBell } from '@tabler/icons-react';
import { IconAlertSquareRounded } from '@tabler/icons-react';
import { IconHistory } from '@tabler/icons-react';
import { IconLogs } from '@tabler/icons-react';
import { IconPlugConnectedX } from '@tabler/icons-react';
import { IconFileDatabase } from '@tabler/icons-react';
import { IconContract } from '@tabler/icons-react';
// import Dataflow from "../pages/configuration/Dataflow";

const appRoutes: RouteType[] = [
  {
    index: true,
    state: "home"
  },
  // {
  //   path: "/projects",
  //   state: "projects",
  //   sidebarProps: {
  //     displayText: "Projects",
  //     icon: < IconApps stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
  //   }
  // },
  {
    path: "/assets",
    state: "assets",
    sidebarProps: {
      displayText: "Assets",
      icon: < IconCoin stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
    },
    child: [
      {
        path: "/assets/view",
        state: "assets.view",
        sidebarProps: {
          displayText: "Asset View",
          icon: <IconLayoutDashboard stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/assets/volumes",
        state: "assets.volumes",
        sidebarProps : {
          displayText : "Volumes",
          icon : <IconClipboardData stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        }
      },
      { 
        path: "/assets/networks",
        state: "assets.network",
        sidebarProps: {
          displayText: "Networks",
          icon: <IconCellSignal5 stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        }
      }
    ]
  },
  {
    path: "/configuration",
    state: "configuration",
    sidebarProps: {
      displayText: "Configurations",
      icon: < IconAdjustmentsHorizontal stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
    },
    child: [
      {
        path: "/configuration/dataflow",
        state: "configuration.dataflow",
        sidebarProps: {
          displayText: "Dataflow",
          icon: <IconHierarchy2 stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/configuration/vault",
        state: "configuration.vault",
        sidebarProps: {
          displayText: "Connection Vault",
          icon: < IconPlugConnectedX stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        }
      },
      { 
        path : "/configuration/master-data",
        state: "configuration.master-data",
        sidebarProps: { 
          displayText: "Master Data",
          icon: < IconFileDatabase stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        }
      },
      {
        path: "/configuration/jobs",
        state: "configuration.jobs",
        sidebarProps: {
          displayText: "Jobs",
          icon: <IconFileDatabase stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        }
      },
      {
        path: "/configuration/config",
        state: "configuration.config",
        sidebarProps: {
          displayText: "Validation Config",
          icon: <IconContract stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        }
      }
    ]
  },
  {
    path: "/settings",
    state: "settings",
    sidebarProps: {
      displayText: "Settings",
      icon: <IconSettings stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
    },
    child: [
      {
        path: "/settings/notification",
        state: "settings.notification",
        sidebarProps: {
          displayText: "Notification",
          icon: <IconBell stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/settings/alerts",
        state: "settings.alerts",
        sidebarProps: {
          displayText: "Alerts",
          icon: <IconAlertSquareRounded stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/settings/users",
        state: "settings.users",
        sidebarProps: {
          displayText: "Users",
          icon: <IconUserSquareRounded stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/settings/roles",
        state: "settings.roles",
        sidebarProps: {
          displayText: "Roles",
          icon: <IconUserCog stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/settings/jobs",
        state: "settings.jobs",
        sidebarProps: {
          displayText: "Jobs",
          icon: <IconHistory stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      }
    ]
  },  {
    path: "/auditlog",
    state: "auditlog",
    sidebarProps: {
      displayText: "auditlog",
      icon: <IconSettings stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
    },
    child: [
      {
        path: "/auditlog/loginAudit",
        state: "auditlog.loginAudit",
        sidebarProps: {
          displayText: "Notification",
          icon: <IconBell stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      },
      {
        path: "/auditlog/systemAudit",
        state: "auditlog.systemAudit",
        sidebarProps: {
          displayText: "Alerts",
          icon: <IconAlertSquareRounded stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
        },
      }
    ]
  },
  {
    path: "/documentation",
    state: "documentation",
    sidebarProps: {
      displayText: "Documentation",
      icon: <IconChecklist stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
    }
  },
  {
    path: "/changelog",
    state: "changelog",
    sidebarProps: {
      displayText: "Changelog",
      icon: <IconLogs stroke={1.5} className="svg text-[#67037a] hover:text-[#fff]" />
    }
  }
];      

export default appRoutes;