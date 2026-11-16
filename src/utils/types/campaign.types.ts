import type { CampaignVariant } from '../scripts/campaignVariants.ts';
import type { ModePaiement } from './vente.types.ts';

export type LeadBookingWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LeadBookingConfig {
  open_weekdays: LeadBookingWeekday[];
  allow_manual_time?: boolean;
  interval_minutes?: 15 | 30 | 60;
  weekly_slots?: Partial<Record<LeadBookingWeekday, string[]>> | null;
}

export interface CampaignConfiguration {
  lead_booking?: LeadBookingConfig | null;
  creantl_booking?: { notify_external?: boolean } | null;
}

export interface CampaignScriptDocument {
  id: string;
  label: string;
  revision: number;
}

export interface Campaign {
  id_campagne: number;
  nom_campagne: string;
  description?: string;
  type_campagne?: CampaignVariant | null;
  id_type_campagne?: number;
  date_debut: string;
  date_fin?: string;
  budget?: number;
  objectif_ventes?: number;
  actif?: boolean;
  statut?: 'inactive' | 'active' | 'terminee';
  autoriser_mobile?: boolean;
  modes_paiement?: ModePaiement[];
  bon_commande_config?: CampaignConfiguration | null;
  script_documents?: CampaignScriptDocument[];
  logo_path?: string | null;
  logo_file_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TypeCampagne {
  id_type_campagne: number;
  libelle: string;
  description?: string;
}

export interface AgentCampagne {
  id_agent_campagne: number;
  id_agent: number;
  id_campagne: number;
  date_affectation: string;
  actif: boolean;
}
