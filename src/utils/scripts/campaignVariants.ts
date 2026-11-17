import type { CommercialFollowup, ViewType } from '../types/index.ts';
import type { Campaign, CampaignScriptDocument } from '../types/campaign.types';
import type { StatutAppel } from '../types/appel.types';
import { STATUT_APPEL_OPTIONS, type StatutAppelOption } from '../constants/appel.constants.ts';

export const CAMPAIGN_VARIANTS = {
  vente: 'vente',
  lead_b2b: 'lead_b2b',
} as const;

export type CampaignVariant = keyof typeof CAMPAIGN_VARIANTS;

export type ActionButtonId =
  | 'plaquette'
  | 'coffret-douceur-gourmand'
  | 'fga-presentation'
  | 'tarifs'
  | 'historique-appels'
  | 'historique-offres'
  | 'rendez-vous'
  | 'commande'
  | `document:${string}`;

export interface CampaignActionConfig {
  id: ActionButtonId;
  label: string;
  group: 'left' | 'right';
  targetView?: ViewType;
  document?: CampaignScriptDocument;
}

export interface CampaignUiConfig {
  variant: CampaignVariant;
  actions: CampaignActionConfig[];
  showPaniers: boolean;
  commandeMode: 'sales' | 'placeholder';
  closingStatuts: StatutAppel[];
}

export interface ProgpaStepDefinition {
  value: number;
  label: string;
}

const VENTE_CLOSING_STATUTS: StatutAppel[] = STATUT_APPEL_OPTIONS.map((option) => option.value);

const LEAD_B2B_CLOSING_STATUTS: StatutAppel[] = [
  'rendez_vous_pris',
  'rdv_pris',
  'abouti',
  'pas_disponible',
  'repondeur',
  'non_abouti',
  'refus_definitif',
  'siege',
  'faillite',
  'pas_attribue',
  'particulier',
  'doublon',
];

const LEAD_B2B_CLOSING_OPTION_OVERRIDES: Partial<Record<StatutAppel, Partial<Pick<StatutAppelOption, 'label' | 'description' | 'icon'>>>> = {
  rendez_vous_pris: {
    label: 'Rendez-vous validé !',
    description: 'Le rendez-vous client est validé',
    icon: '✅',
  },
  rdv_pris: {
    label: 'Relance',
    description: "Rappel a planifier pour valider le rendez-vous client",
    icon: '📞',
  },
  pas_disponible: {
    icon: '🕒',
  },
};

const PROGPA_STEPS: ProgpaStepDefinition[] = [
  { value: 5, label: 'Commande' },
  { value: 4, label: 'Proposition' },
  { value: 3, label: 'Decouverte' },
  { value: 2, label: 'Presentation' },
  { value: 1, label: 'Identification' },
  { value: 0, label: 'Aucun contact' },
];

const VENTE_ACTIONS: CampaignActionConfig[] = [
  { id: 'plaquette', label: 'Plaquette', group: 'left' },
  { id: 'tarifs', label: 'Tarifs', group: 'left' },
  { id: 'historique-appels', label: 'Historique appels', group: 'right', targetView: 'historique-appels' },
  { id: 'historique-offres', label: 'Historique offres', group: 'right', targetView: 'historique-offres' },
  { id: 'rendez-vous', label: 'Rendez-vous', group: 'right', targetView: 'rendez-vous' },
  { id: 'commande', label: 'Commande', group: 'right', targetView: 'commande' },
];

const LEAD_B2B_ACTIONS: CampaignActionConfig[] = [
  { id: 'historique-appels', label: 'Historique appels', group: 'right', targetView: 'historique-appels' },
  { id: 'historique-offres', label: 'Historique rendez-vous', group: 'right', targetView: 'historique-rendez-vous' },
  { id: 'rendez-vous', label: 'Agenda personnel', group: 'right', targetView: 'rendez-vous' },
  { id: 'commande', label: 'Prise de rendez-vous client', group: 'right', targetView: 'commande' },
];

const FGA_CAMPAIGN_ID = 11;
const CREANTL_CAMPAIGN_ID = 15;
const MAISON_HEMEL_CAMPAIGN_ID = 19;
const MAISON_HEMEL_ACTIONS = VENTE_ACTIONS.filter((action) => action.id !== 'tarifs');
const CREANTL_LEAD_B2B_ACTIONS: CampaignActionConfig[] = [
  { id: 'plaquette', label: 'Plaquette', group: 'left' },
  ...LEAD_B2B_ACTIONS,
];
const FGA_LEAD_B2B_ACTIONS: CampaignActionConfig[] = [
  { id: 'fga-presentation', label: 'Présentation', group: 'left' },
  ...LEAD_B2B_ACTIONS,
];

export function normalizeCampaignVariant(value: string | null | undefined): CampaignVariant {
  if (value === CAMPAIGN_VARIANTS.lead_b2b) {
    return CAMPAIGN_VARIANTS.lead_b2b;
  }

  return CAMPAIGN_VARIANTS.vente;
}

export function getCampaignVariant(campaign?: Pick<Campaign, 'type_campagne'> | null): CampaignVariant {
  return normalizeCampaignVariant(campaign?.type_campagne);
}

export function isLeadB2BCampaign(campaign?: Pick<Campaign, 'type_campagne' | 'nom_campagne'> | null): boolean {
  if (getCampaignVariant(campaign) === CAMPAIGN_VARIANTS.lead_b2b) {
    return true;
  }

  const campaignName = campaign?.nom_campagne?.toLowerCase() ?? '';
  return campaignName.includes('mma') || campaignName.includes('planete assurance') || campaignName.includes('assurance');
}

type CampaignUiSource = Pick<Campaign, 'type_campagne'> & Partial<Pick<Campaign, 'id_campagne' | 'script_documents' | 'script_documents_version'>>;

function withScriptDocuments(actions: CampaignActionConfig[], campaign?: CampaignUiSource | null): CampaignActionConfig[] {
  const documents = campaign?.script_documents;
  if (!documents) return actions;
  const id = Number(campaign?.id_campagne);
  const existing = campaign?.script_documents_version === 2
    ? actions.filter(({ group }) => group !== 'left')
    : [7, 15].includes(id) ? actions : actions.filter((action) => action.id !== 'plaquette');
  return [
    ...existing,
    ...documents.map((document): CampaignActionConfig => ({
      id: `document:${document.id}`, label: document.label, group: 'left', document,
    })),
  ];
}

export function getCampaignUiConfig(campaign?: CampaignUiSource | null): CampaignUiConfig {
  const variant = getCampaignVariant(campaign);

  if (variant === CAMPAIGN_VARIANTS.lead_b2b) {
    return {
      variant,
      actions: withScriptDocuments(Number(campaign?.id_campagne) === FGA_CAMPAIGN_ID
        ? FGA_LEAD_B2B_ACTIONS
        : Number(campaign?.id_campagne) === CREANTL_CAMPAIGN_ID
          ? CREANTL_LEAD_B2B_ACTIONS
          : LEAD_B2B_ACTIONS, campaign),
      showPaniers: false,
      commandeMode: 'placeholder',
      closingStatuts: LEAD_B2B_CLOSING_STATUTS,
    };
  }

  return {
    variant,
    actions: withScriptDocuments(Number(campaign?.id_campagne) === 7
      ? [...VENTE_ACTIONS.slice(0, 2), { id: 'coffret-douceur-gourmand', label: 'Coffret Douceur & Gourmand', group: 'left' }, ...VENTE_ACTIONS.slice(2)]
      : Number(campaign?.id_campagne) === MAISON_HEMEL_CAMPAIGN_ID
        ? MAISON_HEMEL_ACTIONS
        : VENTE_ACTIONS, campaign),
    showPaniers: true,
    commandeMode: 'sales',
    closingStatuts: VENTE_CLOSING_STATUTS,
  };
}

export function getCampaignClosingOptions(campaign?: Pick<Campaign, 'type_campagne'> | null): StatutAppelOption[] {
  const variant = getCampaignVariant(campaign);
  const optionByValue = new Map(
    STATUT_APPEL_OPTIONS.map((option) => [option.value, option] as const),
  );

  return getCampaignUiConfig(campaign).closingStatuts.flatMap((statut) => {
    const option = optionByValue.get(statut);
    if (!option) {
      return [];
    }

    if (variant !== CAMPAIGN_VARIANTS.lead_b2b) {
      return [option];
    }

    const overrides = LEAD_B2B_CLOSING_OPTION_OVERRIDES[statut];
    return [overrides ? { ...option, ...overrides } : option];
  });
}

export function requiresCampaignAgendaRendezVous(
  campaignVariant: CampaignVariant | null | undefined,
  statut: StatutAppel | null | undefined,
): boolean {
  if (!statut) {
    return false;
  }

  if (statut === 'relance' || statut === 'rdv_pris') {
    return true;
  }

  return statut === 'rendez_vous_pris'
    && normalizeCampaignVariant(campaignVariant) !== CAMPAIGN_VARIANTS.lead_b2b;
}

export function getCampaignAgendaRendezVousMotif(
  campaignVariant: CampaignVariant | null | undefined,
  statut: StatutAppel | null | undefined,
): string | null {
  if (!requiresCampaignAgendaRendezVous(campaignVariant, statut)) {
    return null;
  }

  if (statut === 'relance'
    || (statut === 'rdv_pris' && normalizeCampaignVariant(campaignVariant) === CAMPAIGN_VARIANTS.lead_b2b)) {
    return 'Relance';
  }

  if (statut === 'rdv_pris') {
    return 'Commande à établir';
  }

  return 'Rendez-vous pris';
}

export function getCampaignProgpaSteps(_campaignVariant?: CampaignVariant | null): ProgpaStepDefinition[] {
  return PROGPA_STEPS;
}

export interface CommercialFollowupPresentation {
  badge: string;
  label: string;
  note: string;
}

export function getCommercialFollowupPresentation(
  followup?: CommercialFollowup | null,
): CommercialFollowupPresentation | null {
  if (!followup) {
    return null;
  }

  if (followup.type === 'lead') {
    return {
      badge: 'Suivi 5+',
      label: 'Rendez-vous client en suivi',
      note: "Le rendez-vous client est en attente de validation ou d'annulation. Le ProgPA est verrouillé pour cet appel de suivi.",
    };
  }

  return {
    badge: 'Suivi 5+',
    label: 'Commande en suivi',
    note: "La commande est en attente de validation ou d'annulation. Le ProgPA est verrouillé pour cet appel de suivi.",
  };
}
