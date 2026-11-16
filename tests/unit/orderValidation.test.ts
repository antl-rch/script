import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVentePayload, synchronizeOrderCompanyNames, validateOrderForm } from '../../src/utils/scripts/orderValidation.ts';

const baseFormData = {
  raison_sociale_facturation: 'Cabinet Médical Alpha Facturation',
  adresse_facturation: '10 rue des Lilas',
  adresse_livraison: '20 avenue Victor Hugo',
  raison_sociale: 'Cabinet Médical Alpha',
  raison_sociale_livraison: 'Pharmacie Centrale Beta',
  code_postal_facturation: '75001',
  code_postal_livraison: '69002',
  ville_facturation: 'Paris',
  ville_livraison: 'Lyon',
  pays_facturation: 'France',
  pays_livraison: 'France',
  meme_adresse: false,
  mode_paiement: 'Cheque',
  notes: '  Merci de rappeler avant livraison  ',
  delais_livraison: 4 as const,
  delai_facturation: 45 as const,
  civilite: 'Mme',
  nom_contact: 'Durand',
  plage_horaire_livraison: '  9h-12h  ',
  livraison_offerte: true,
};

test('la raison sociale principale alimente les raisons sociales encore par défaut', () => {
  const synchronized = synchronizeOrderCompanyNames(baseFormData, 'raison_sociale', 'SAS Goubier');

  assert.equal(synchronized.raison_sociale, 'SAS Goubier');
  assert.equal(synchronized.raison_sociale_facturation, 'Cabinet Médical Alpha Facturation');
  assert.equal(synchronized.raison_sociale_livraison, 'Pharmacie Centrale Beta');

  const defaults = synchronizeOrderCompanyNames({
    ...baseFormData,
    raison_sociale_facturation: baseFormData.raison_sociale,
    raison_sociale_livraison: baseFormData.raison_sociale,
  }, 'raison_sociale', 'SAS Goubier');

  assert.equal(defaults.raison_sociale_facturation, 'SAS Goubier');
  assert.equal(defaults.raison_sociale_livraison, 'SAS Goubier');
});

test('une raison sociale explicitement différente reste indépendante', () => {
  const synchronized = synchronizeOrderCompanyNames({
    ...baseFormData,
    raison_sociale_facturation: 'Facturation dédiée',
    raison_sociale_livraison: 'Livraison dédiée',
  }, 'raison_sociale', 'SAS Goubier');

  assert.equal(synchronized.raison_sociale_facturation, 'Facturation dédiée');
  assert.equal(synchronized.raison_sociale_livraison, 'Livraison dédiée');
});

test('une raison sociale de livraison reste indépendante avec la même adresse', () => {
  const synchronized = synchronizeOrderCompanyNames({
    ...baseFormData,
    meme_adresse: true,
  }, 'raison_sociale_facturation', 'Facturation dédiée');

  assert.equal(synchronized.raison_sociale_facturation, 'Facturation dédiée');
  assert.equal(synchronized.raison_sociale_livraison, 'Pharmacie Centrale Beta');
});

test('validateOrderForm remonte les erreurs attendues', () => {
  const errors = validateOrderForm({
    ...baseFormData,
    adresse_facturation: ' ',
    code_postal_facturation: '75',
    ville_facturation: '',
    pays_facturation: '',
    adresse_livraison: '',
    code_postal_livraison: 'abcde',
    ville_livraison: '',
    pays_livraison: '',
    civilite: '',
    nom_contact: '',
  });

  assert.equal(errors.adresse_facturation, "L'adresse de facturation est obligatoire");
  assert.equal(errors.code_postal_facturation, 'Le code postal doit contenir 5 chiffres');
  assert.equal(errors.ville_facturation, 'La ville de facturation est obligatoire');
  assert.equal(errors.pays_facturation, 'Le pays de facturation est obligatoire');
  assert.equal(errors.adresse_livraison, "L'adresse de livraison est obligatoire");
  assert.equal(errors.code_postal_livraison, 'Le code postal doit contenir 5 chiffres');
  assert.equal(errors.ville_livraison, 'La ville de livraison est obligatoire');
  assert.equal(errors.pays_livraison, 'Le pays de livraison est obligatoire');
  assert.equal(errors.civilite, 'La civilité du contact est obligatoire');
  assert.equal(errors.nom_contact, 'Le nom du contact est obligatoire');
});

test('validateOrderForm ignore les champs de livraison si meme_adresse est vrai', () => {
  const errors = validateOrderForm({
    ...baseFormData,
    meme_adresse: true,
    adresse_livraison: '',
    code_postal_livraison: '',
    ville_livraison: '',
    pays_livraison: '',
  });

  assert.deepEqual(errors, {});
});

test('buildVentePayload réutilise l’adresse de facturation si meme_adresse est vrai', () => {
  const payload = buildVentePayload({
    prospectId: 17,
    campagneId: 4,
    appelId: 12,
    formData: {
      ...baseFormData,
      meme_adresse: true,
      notes: '   ',
      plage_horaire_livraison: '   ',
    },
    items: [
      {
        produit: { id_produit: 9 },
        quantite: 2,
        prix_unitaire: 150,
        remise: 10,
      },
    ],
  });

  assert.equal(payload.id_prospect, 17);
  assert.equal(payload.id_campagne, 4);
  assert.equal(payload.id_appel, 12);
  assert.equal(payload.delais_livraison, 4);
  assert.equal(payload.delai_facturation, 45);
  assert.equal(payload.raison_sociale_facturation, 'Cabinet Médical Alpha Facturation');
  assert.equal(payload.adresse_livraison, '10 Rue Des Lilas');
  assert.equal(payload.raison_sociale_livraison, 'Pharmacie Centrale Beta');
  assert.equal(payload.code_postal_livraison, '75001');
  assert.equal(payload.ville_livraison, 'Paris');
  assert.equal(payload.notes, undefined);
  assert.equal(payload.plage_horaire_livraison, undefined);
  assert.deepEqual(payload.details, [
    {
      id_produit: 9,
      quantite: 2,
      prix_unitaire: 150,
      remise: 10,
    },
  ]);
});

test('buildVentePayload utilise la raison sociale principale pour les valeurs non renseignées', () => {
  const payload = buildVentePayload({
    prospectId: 19,
    campagneId: 5,
    formData: {
      ...baseFormData,
      raison_sociale: 'BIOCOOP',
      raison_sociale_facturation: '',
      raison_sociale_livraison: '',
      meme_adresse: true,
    },
    items: [],
  });

  assert.equal(payload.raison_sociale_facturation, 'BIOCOOP');
  assert.equal(payload.raison_sociale_livraison, 'BIOCOOP');
});

test('buildVentePayload sépare facturation et livraison même à la même adresse', () => {
  const payload = buildVentePayload({
    prospectId: 20,
    campagneId: 5,
    formData: {
      ...baseFormData,
      raison_sociale: 'BIOCOOP',
      raison_sociale_facturation: 'SCOP BIOPTIMISTE',
      raison_sociale_livraison: 'BIOCOOP',
      meme_adresse: true,
    },
    items: [],
  });

  assert.equal(payload.raison_sociale_facturation, 'SCOP BIOPTIMISTE');
  assert.equal(payload.raison_sociale_livraison, 'BIOCOOP');
  assert.equal(payload.adresse_livraison, '10 Rue Des Lilas');
});

test('buildVentePayload conserve une adresse et raison sociale de livraison dédiée si nécessaire', () => {
  const payload = buildVentePayload({
    prospectId: 18,
    campagneId: 5,
    formData: baseFormData,
    items: [],
  });

  assert.equal(payload.adresse_livraison, '20 Avenue Victor Hugo');
  assert.equal(payload.raison_sociale_livraison, 'Pharmacie Centrale Beta');
  assert.equal(payload.code_postal_livraison, '69002');
  assert.equal(payload.ville_livraison, 'Lyon');
  assert.equal(payload.pays_livraison, 'France');
  assert.equal(payload.notes, 'Merci de rappeler avant livraison');
  assert.equal(payload.plage_horaire_livraison, '9h-12h');
});

test('buildVentePayload n ajoute pas id_appel si aucun appel courant n est fourni', () => {
  const payload = buildVentePayload({
    prospectId: 18,
    campagneId: 5,
    formData: baseFormData,
    items: [],
  });

  assert.equal('id_appel' in payload, false);
});

test('STATUT_VENTE_LABELS et STATUT_VENTE_COLORS exposent les libellés et couleurs attendus', async () => {
  const { STATUT_VENTE_LABELS, STATUT_VENTE_COLORS } = await import('../../src/utils/types/index.ts');
  assert.equal(STATUT_VENTE_LABELS.en_attente, 'En attente');
  assert.equal(STATUT_VENTE_LABELS.validee, 'Validée');
  assert.equal(STATUT_VENTE_LABELS.annulee, 'Annulée');
  assert.equal(STATUT_VENTE_LABELS.frigo, 'Frigo');

  assert.equal(STATUT_VENTE_COLORS.en_attente, '#f59e0b');
  assert.equal(STATUT_VENTE_COLORS.validee, '#22c55e');
  assert.equal(STATUT_VENTE_COLORS.annulee, '#ef4444');
  assert.equal(STATUT_VENTE_COLORS.frigo, '#6b7280');
});
