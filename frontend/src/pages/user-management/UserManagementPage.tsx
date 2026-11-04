import React, { useState, useEffect, useCallback } from "react";
import useImpression from "@/hooks/useImpression";
import useInteract from "@/hooks/useInteract";
import { useTelemetry } from "@/hooks/useTelemetry";
import { FiShield, FiLock, FiTarget, FiLayers } from "react-icons/fi";
import { useToast } from "@/hooks/useToast";
import { useAppI18n } from "@/hooks/useAppI18n";
import {
  userManagementService,
  type RoleItem,
  type OrganisationOption,
} from "@/services/UserManagementService";
import RoleManagementTab from "./RoleManagementTab";
import { CompetencyRoleTab } from "./CompetencyRoleTab";
import { SkillFrameworkTab } from "./SkillFrameworkTab";
import UserConsentTab from "./UserConsentTab";
import { TermsAndConditionsDialog } from "@/components/termsAndCondition/TermsAndConditionsDialog";
import { useSystemSetting } from "@/hooks/useSystemSetting";
import { useAcceptTnc, useGetTncUrl } from "@/hooks/useTnc";
import { useUserRead } from "@/hooks/useUserRead";
import { TncService } from "@/services/TncService";
import { TelemetryTracker } from '@/components/telemetry/TelemetryTracker';
import _ from "lodash";
import "../home/home.css";
import "./user-management.css";

/* ── Types ──────────────────────────────────────────────────────────────── */

type UMTab = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const getUmTabs = (t: (k: string) => string): UMTab[] => [
  { id: "role-management", label: t("userManagement.tabs.changeUserRoles"), icon: FiShield },
  { id: "user-consent", label: t("userManagement.tabs.userConsent"), icon: FiLock },
  { id: "competency-role", label: t("userManagement.tabs.competencyRole"), icon: FiTarget },
  { id: "skill-framework", label: t("userManagement.tabs.skillFramework"), icon: FiLayers },
];

/* ── Main Page ───────────────────────────────────────────────────────────── */

const UserManagementPage = () => {
  const { t } = useAppI18n();
  const { toast } = useToast();
  useImpression({ type: 'view', pageid: 'user-management', env: 'user-management' });
  const { interact } = useInteract();
  const telemetry = useTelemetry();

  const UM_TABS = getUmTabs(t);
  const [activeTab, setActiveTab] = useState<string>(UM_TABS[0]?.id ?? "role-management");
  const [availableRoles, setAvailableRoles] = useState<RoleItem[]>([]);
  const [tncDialogOpen, setTncDialogOpen] = useState(false);
  // The Competency Role tab's framework, kept here so switching tabs doesn't lose it.
  const [roleFrameworkId, setRoleFrameworkId] = useState('');

  /* ── Fetch orgAdminTnc; fall back to tncConfig if no URL is found ── */
  const { data: orgAdminTncConfig, isSuccess: isOrgTncSuccess } = useSystemSetting('orgAdminTnc');
  const { data: fallbackTncConfig, isSuccess: isFallbackSuccess } = useSystemSetting('tncConfig');

  const { data: orgAdminTncUrl } = useGetTncUrl(isOrgTncSuccess ? orgAdminTncConfig : null);
  const { data: fallbackTncUrl } = useGetTncUrl(isFallbackSuccess ? fallbackTncConfig : null);

  const termsUrl = orgAdminTncUrl || fallbackTncUrl || '';
  const activeTncConfig = orgAdminTncUrl ? orgAdminTncConfig : fallbackTncConfig;
  const activeTncType = orgAdminTncUrl ? 'orgAdminTnc' : 'tncConfig';

  const acceptTncMutation = useAcceptTnc();
  const { data: userRes, refetch: refetchUser } = useUserRead();

  const shouldShowTnc = (() => {
    if (!termsUrl || !activeTncConfig || !userRes) return false;
    const tncService = new TncService();
    const latestVersion = tncService.getLatestVersion(activeTncConfig);
    const acceptedVersion = _.get(userRes?.data, ['response', 'allTncAccepted', activeTncType, 'version']);
    return latestVersion !== acceptedVersion;
  })();

  const userOrganisations = React.useMemo((): OrganisationOption[] => {
    const orgs: OrganisationOption[] = [];
    const responseData: any = _.get(userRes, 'data.response', {});
    
    // 1. Check rootOrg object
    if (responseData.rootOrg) {
      orgs.push({
        organisationId: responseData.rootOrg.id || responseData.rootOrg.rootOrgId || responseData.rootOrgId,
        orgName: responseData.rootOrg.orgName || responseData.rootOrgName
      });
    } 
    // 2. Fallback to top-level rootOrgId/rootOrgName if rootOrg object is missing/incomplete
    else if (responseData.rootOrgId) {
      orgs.push({
        organisationId: responseData.rootOrgId,
        orgName: responseData.rootOrgName || 'Root Organisation'
      });
    }

    // 3. Add other organisations if any
    if (Array.isArray(responseData.organisations)) {
      responseData.organisations.forEach((org: any) => {
        const orgId = org.organisationId || org.id;
        const orgName = org.orgName || org.name;
        if (orgId && !orgs.find(o => o.organisationId === orgId)) {
          orgs.push({
            organisationId: orgId,
            orgName: orgName || 'Unknown Organisation'
          });
        }
      });
    }
    
    return orgs;
  }, [userRes]);

  // Knowlg lets the proxy's X-Channel-Id (session root org) win over the body, so match it here.
  const rootOrgChannel: string = _.get(userRes, 'data.response.rootOrg.hashTagId') || _.get(userRes, 'data.response.rootOrgId') || '';
  const rootOrgName: string | undefined = _.get(userRes, 'data.response.rootOrg.orgName');

  const loadRoles = useCallback(async () => {
    try {
      const response = await userManagementService.getRoles();
      // Service might return { data: { result: { response: { roleList } } } } 
      // or { data: { result: { roles } } } or { data: { roles } }
      const roles: RoleItem[] = 
        response.data?.result?.response?.roleList ?? 
        response.data?.result?.roles ?? 
        response.data?.roles ?? 
        [];
      setAvailableRoles(roles.filter((r) => r.id !== 'PUBLIC'));
    } catch {
      toast({ title: t("userManagement.toast.failedToLoadRoles"), description: t("userManagement.toast.rolesCouldNotBeLoaded"), variant: "destructive" });
    }
  }, [toast, t]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleAcceptOrgTnc = async () => {
    if (!activeTncConfig) return;
    try {
      await acceptTncMutation.mutateAsync({ tncConfig: activeTncConfig, tncType: activeTncType });
      setTncDialogOpen(false);
      refetchUser();
      telemetry.audit({
        edata: { props: ['tncAccepted'], state: 'Accepted' },
        object: { id: userRes?.data?.response?.userId || '', type: 'User' },
      });
      toast({ title: t("userManagement.toast.termsAccepted"), description: t("userManagement.toast.termsAcceptedDesc"), variant: "success" });
    } catch {
      toast({ title: t("userManagement.toast.failedToAcceptTerms"), description: t("userManagement.toast.pleaseRetry"), variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TelemetryTracker 
        startEventInput={{ type: 'workflow', mode: 'user-management', pageid: 'user-management-page' }}
        endEventInput={{ type: 'workflow', mode: 'user-management', pageid: 'user-management-completion' }}
      />
      <main className="workspace-main-content">
        <div className="workspace-content-wrapper">

              {/* ── Page header ── */}
              <div className="um-page-header">
                <h1 className="um-page-title">{t("userManagement.pageTitle")}</h1>
                <p className="text-xs text-sunbird-gray-75 mt-1 font-rubik">
                  {t("userManagement.disclaimer.intro")}{" "}
                  {termsUrl ? (
                    <TermsAndConditionsDialog
                      termsUrl={termsUrl}
                      title={t("userManagement.disclaimer.termsLink")}
                      open={tncDialogOpen}
                      onOpenChange={setTncDialogOpen}
                      onAccept={shouldShowTnc ? handleAcceptOrgTnc : undefined}
                      accepting={acceptTncMutation.isPending}
                    >
                      <button
                        type="button"
                        data-edataid="um-tnc-open"
                        data-pageid="user-management"
                        className="underline text-sunbird-theme-accent hover:opacity-80 font-medium"
                      >
                        {t("userManagement.disclaimer.termsLink")}
                      </button>
                    </TermsAndConditionsDialog>
                  ) : (
                    <span className="font-medium text-sunbird-obsidian">{t("userManagement.disclaimer.termsLink")}</span>
                  )}
                  {t("userManagement.disclaimer.outro")}
                </p>
              </div>

              {/* ── Top Tabs layout ── */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border min-h-[32rem]">

                {/* Top Tabs */}
                <div className="border-b border-border bg-gray-50/50 px-4 pt-4">
                  <nav className="flex gap-6">
                    {UM_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            interact({ id: 'um-tab-switch', type: 'CLICK', pageid: 'user-management', cdata: [{ id: tab.id, type: 'Tab' }] });
                            setActiveTab(tab.id);
                          }}
                          className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-[0.9375rem] font-medium transition-colors ${
                            isActive
                              ? "border-sunbird-theme-accent text-sunbird-theme-accent"
                              : "border-transparent text-sunbird-gray-75 hover:text-sunbird-obsidian hover:border-gray-300"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Content area */}
                <div className="p-6">
                  {activeTab === "role-management" && (
                    <RoleManagementTab
                      availableRoles={availableRoles}
                      onRefreshSearch={loadRoles}
                      userOrganisations={userOrganisations}
                    />
                  )}
                  {activeTab === "user-consent" && <UserConsentTab />}
                  {activeTab === "competency-role" && (
                    <CompetencyRoleTab channel={rootOrgChannel} frameworkId={roleFrameworkId} onFrameworkChange={setRoleFrameworkId} />
                  )}
                  {activeTab === "skill-framework" && (
                    <SkillFrameworkTab channel={rootOrgChannel} orgName={rootOrgName} />
                  )}
                </div>

              </div>
            </div>
        </main>
    </div>
  );
};

export default UserManagementPage;
