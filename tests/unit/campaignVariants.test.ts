import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMPAIGN_VARIANTS,
  getCampaignClosingOptions,
  getCampaignAgendaRendezVousMotif,
  getCommercialFollowupPresentation,
  getCampaignProgpaSteps,
  getCampaignUiConfig,
  isLeadB2BCampaign,
  normalizeCampaignVariant,
  requiresCampaignAgendaRendezVous,
} from '../../src/utils/scripts/campaignVariants.ts';

test('normalizeCampaignVariant applique un fallback vente', () => {
  assert.equal(normalizeCampaignVariant(CAMPAIGN_VARIANTS.vente), CAMPAIGN_VARIANTS.vente);
  assert.equal(normalizeCampaignVariant(CAMPAIGN_VARIANTS.lead_b2b), CAMPAIGN_VARIANTS.lead_b2b);
  assert.equal(normalizeCampaignVariant('legacy'), CAMPAIGN_VARIANTS.vente);
  assert.equal(normalizeCampaignVariant(undefined), CAMPAIGN_VARIANTS.vente);
});

test('getCampaignUiConfig retourne la matrice vente attendue', () => {
  const config = getCampaignUiConfig({ type_campagne: CAMPAIGN_VARIANTS.vente });

  assert.equal(config.showPaniers, true);
  assert.equal(config.commandeMode, 'sales');
  assert.deepEqual(
    config.actions.map((action) => action.label),
    ['Plaquette', 'Tarifs', 'Historique appels', 'Historique offres', 'Rendez-vous', 'Commande'],
  );
});

test('getCampaignUiConfig retourne la matrice MMA attendue', () => {
  const config = getCampaignUiConfig({ type_campagne: CAMPAIGN_VARIANTS.lead_b2b });

  assert.equal(config.showPaniers, false);
  assert.equal(config.commandeMode, 'placeholder');
  assert.deepEqual(
    config.actions.map((action) => action.label),
    ['Historique appels', 'Historique rendez-vous', 'Agenda personnel', 'Prise de rendez-vous client'],
  );
  assert.equal(config.actions.find((action) => action.id === 'historique-offres')?.targetView, 'historique-rendez-vous');
});

test('Maison Hemel propose seulement la plaquette parmi les actions documentaires', () => {
  const maisonHemel = getCampaignUiConfig({ id_campagne: 19, type_campagne: CAMPAIGN_VARIANTS.vente });
  const cigales = getCampaignUiConfig({ id_campagne: 7, type_campagne: CAMPAIGN_VARIANTS.vente });

  assert.deepEqual(maisonHemel.actions.filter(({ group }) => group === 'left').map(({ id }) => id), ['plaquette']);
  assert.equal(cigales.actions.some(({ id }) => id === 'tarifs'), true);
});

test('getCampaignUiConfig expose la présentation uniquement pour FGA', () => {
  const fgaConfig = getCampaignUiConfig({ id_campagne: 11, type_campagne: CAMPAIGN_VARIANTS.lead_b2b });
  const mmaConfig = getCampaignUiConfig({ id_campagne: 2, type_campagne: CAMPAIGN_VARIANTS.lead_b2b });

  assert.equal(fgaConfig.actions[0]?.id, 'fga-presentation');
  assert.equal(mmaConfig.actions.some((action) => action.id === 'fga-presentation'), false);
});

test('getCampaignClosingOptions conserve le closing vente historique pour Cigales', () => {
  const options = getCampaignClosingOptions({ type_campagne: CAMPAIGN_VARIANTS.vente });

  assert.deepEqual(
    options.map((option) => option.value),
    [
      'vente_conclue',
      'relance',
      'rdv_pris',
      'rendez_vous_pris',
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
    ],
  );
});

test('getCampaignClosingOptions retire les statuts purement vente pour MMA', () => {
  const options = getCampaignClosingOptions({ type_campagne: CAMPAIGN_VARIANTS.lead_b2b });

  assert.deepEqual(
    options.map((option) => option.value),
    [
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
    ],
  );
  assert.equal(options[0]?.label, 'Rendez-vous validé !');
  assert.equal(options[1]?.label, 'Relance');
  assert.notEqual(options[0]?.icon, options[1]?.icon);
  assert.notEqual(options[1]?.icon, options.find((option) => option.value === 'pas_disponible')?.icon);
});

test('getCampaignProgpaSteps conserve les mêmes étapes dans toutes les campagnes', () => {
  assert.equal(getCampaignProgpaSteps(CAMPAIGN_VARIANTS.vente)[0]?.label, 'Commande');
  assert.equal(getCampaignProgpaSteps(CAMPAIGN_VARIANTS.lead_b2b)[0]?.label, 'Commande');
});

test('les statuts de relance exigent un rendez-vous agenda pour toutes les variantes', () => {
  assert.equal(requiresCampaignAgendaRendezVous(CAMPAIGN_VARIANTS.vente, 'relance'), true);
  assert.equal(requiresCampaignAgendaRendezVous(CAMPAIGN_VARIANTS.lead_b2b, 'rdv_pris'), true);
  assert.equal(requiresCampaignAgendaRendezVous(CAMPAIGN_VARIANTS.vente, 'rdv_pris'), true);
  assert.equal(requiresCampaignAgendaRendezVous(CAMPAIGN_VARIANTS.vente, 'rendez_vous_pris'), true);
  assert.equal(requiresCampaignAgendaRendezVous(CAMPAIGN_VARIANTS.lead_b2b, 'rendez_vous_pris'), false);
  assert.equal(requiresCampaignAgendaRendezVous(CAMPAIGN_VARIANTS.lead_b2b, 'abouti'), false);
});

test('le motif agenda distingue la relance du rendez-vous client MMA', () => {
  assert.equal(getCampaignAgendaRendezVousMotif(CAMPAIGN_VARIANTS.vente, 'relance'), 'Relance');
  assert.equal(getCampaignAgendaRendezVousMotif(CAMPAIGN_VARIANTS.lead_b2b, 'rdv_pris'), 'Relance');
  assert.equal(getCampaignAgendaRendezVousMotif(CAMPAIGN_VARIANTS.vente, 'rdv_pris'), 'Commande à établir');
  assert.equal(getCampaignAgendaRendezVousMotif(CAMPAIGN_VARIANTS.vente, 'rendez_vous_pris'), 'Rendez-vous pris');
  assert.equal(getCampaignAgendaRendezVousMotif(CAMPAIGN_VARIANTS.lead_b2b, 'rendez_vous_pris'), null);
});

test('getCommercialFollowupPresentation expose un état 5+ distinct du ProgPA numérique', () => {
  const vente = getCommercialFollowupPresentation({
    type: 'vente',
    id_source: 73,
    id_appel_source: 26477,
    statut: 'en_attente',
    date_creation: '2026-08-03T09:14:15.000Z',
  });
  const lead = getCommercialFollowupPresentation({
    type: 'lead',
    id_source: 12,
    id_appel_source: 88,
    statut: 'planifie',
    date_creation: '2026-08-01T08:00:00.000Z',
  });

  assert.equal(vente?.badge, 'Suivi 5+');
  assert.equal(vente?.label, 'Commande en suivi');
  assert.equal(lead?.label, 'Rendez-vous client en suivi');
});

test('isLeadB2BCampaign n utilise plus de dependance aux ids de campagne', () => {
  assert.equal(
    isLeadB2BCampaign({ type_campagne: CAMPAIGN_VARIANTS.lead_b2b, nom_campagne: 'Campagne MMA' }),
    true,
  );
  assert.equal(
    isLeadB2BCampaign({ type_campagne: CAMPAIGN_VARIANTS.vente, nom_campagne: 'Les Cigales' }),
    false,
  );
  assert.equal(
    isLeadB2BCampaign({ type_campagne: CAMPAIGN_VARIANTS.vente, nom_campagne: 'MMA Planete Assurance' }),
    true,
  );
});

test('Creantl expose la plaquette sans ajouter les outils Cigales aux autres leads', () => {
  const creantl = getCampaignUiConfig({ id_campagne: 15, type_campagne: CAMPAIGN_VARIANTS.lead_b2b });
  assert.equal(creantl.actions[0]?.id, 'plaquette');
  assert.equal(creantl.actions.some((action) => action.id === 'tarifs'), false);
  for (const id_campagne of [10, 11, 12, 14]) {
    assert.equal(getCampaignUiConfig({ id_campagne, type_campagne: CAMPAIGN_VARIANTS.lead_b2b }).actions.some((action) => action.id === 'plaquette'), false);
  }
});

test('les coffrets sont disponibles uniquement pour Les Cigales', () => {
  const cigales = getCampaignUiConfig({ id_campagne: 7, type_campagne: 'vente' });
  assert.equal(cigales.actions.find(action => action.id === 'coffret-douceur-gourmand')?.label, 'Coffret Douceur & Gourmand');
  for (const id_campagne of [8, 11, 15]) {
    assert.equal(getCampaignUiConfig({ id_campagne, type_campagne: 'vente' }).actions.some(action => action.id === 'coffret-douceur-gourmand'), false);
  }
});
