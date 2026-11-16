import type { Produit } from './cart.types.ts';

export type StatutVente = 'en_attente' | 'validee' | 'annulee' | 'frigo';
export type ModePaiement = 'CB' | 'Prelevement' | 'Cheque' | 'Virement';

export const STATUT_VENTE_LABELS: Record<StatutVente, string> = {
  en_attente: 'En attente',
  validee: 'Validée',
  annulee: 'Annulée',
  frigo: 'Frigo',
};

export const STATUT_VENTE_COLORS: Record<StatutVente, string> = {
  en_attente: '#f59e0b',
  validee: '#22c55e',
  annulee: '#ef4444',
  frigo: '#6b7280',
};

export interface DetailVente {
  id_detail?: number;
  id_produit?: number;
  id_panier?: number;
  quantite: number;
  prix_unitaire: number;
  remise: number;
  montant_ligne?: number;
  produit?: Produit; // Relation optionnelle avec le produit (minuscule = Sequelize)
  panier?: {
    id_panier: number;
    label: string;
    prix_ht?: number | null;
  };
}

export interface VenteProspectSummary {
  id_prospect: number;
  nom: string;
  prenom?: string | null;
  raison_sociale?: string | null;
  telephone?: string | null;
}

export interface Vente {
  id_vente: number;
  id_prospect: number;
  id_agent: number;
  id_agent_suivi?: number | null;
  id_campagne: number;
  id_appel?: number | null;
  date_vente: string;
  montant_total: number;
  /** Référence communicable au superviseur pour suivre le bon de commande. */
  reference_doc?: string | null;
  mode_paiement?: ModePaiement | null;
  statut_vente?: StatutVente;
  statut?: StatutVente;
  created_at: string;
  updated_at: string;
  details?: DetailVente[]; // Alias Sequelize pour les détails de vente
  prospect?: VenteProspectSummary;
  raison_sociale_facturation?: string;
  adresse_facturation?: string;
  adresse_livraison?: string;
  raison_sociale_livraison?: string;
  code_postal_facturation?: string;
  code_postal_livraison?: string;
  ville_facturation?: string;
  ville_livraison?: string;
  pays_facturation?: string;
  pays_livraison?: string;
  notes?: string;
  delais_livraison?: DelaisLivraison | null;
  delai_facturation?: DelaiFacturation | null;
  livraison_offerte?: boolean;
  plage_horaire_livraison?: string;
}

export type DelaisLivraison = 2 | 3 | 4;
export type DelaiFacturation = 30 | 45;

export interface CreateVenteData {
  id_prospect: number;
  id_campagne: number;
  id_appel?: number;
  mode_paiement?: ModePaiement;
  delais_livraison?: DelaisLivraison;
  delai_facturation?: DelaiFacturation;
  raison_sociale_facturation?: string;
  adresse_facturation?: string;
  adresse_livraison?: string;
  raison_sociale_livraison?: string;
  code_postal_facturation?: string;
  code_postal_livraison?: string;
  ville_facturation?: string;
  ville_livraison?: string;
  pays_facturation?: string;
  pays_livraison?: string;
  notes?: string;
  livraison_offerte?: boolean;
  plage_horaire_livraison?: string;
  details: Omit<DetailVente, 'id_detail' | 'montant_ligne'>[];
}
