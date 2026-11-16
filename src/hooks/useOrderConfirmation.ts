import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useCart, useProspect, useCampaign, useUser, useDialer } from './index';
import type { AddressSelectionResult, ModePaiement, DelaisLivraison, DelaiFacturation } from '../utils/types/index.ts';
import { closingService } from '../API/services/index.ts';
import { buildVentePayload, getCampaignVariant, getProspectDeliveryPrefill, validateOrderForm, capitalizeAddress, synchronizeOrderCompanyNames, formatCurrency } from '../utils/scripts/index.ts';

const CIGALES_DELIVERY_DELAYS: DelaisLivraison[] = [2, 4];
const DELIVERY_DELAYS: DelaisLivraison[] = [2, 3, 4];

interface FormData {
  raison_sociale_facturation: string;
  adresse_facturation: string;
  adresse_livraison: string;
  code_postal_facturation: string;
  code_postal_livraison: string;
  ville_facturation: string;
  ville_livraison: string;
  pays_facturation: string;
  pays_livraison: string;
  meme_adresse: boolean;
  mode_paiement: ModePaiement | '';
  notes: string;
  siret: string;
  email: string;
  raison_sociale: string;
  raison_sociale_livraison: string;
  delais_livraison: DelaisLivraison;
  delai_facturation: DelaiFacturation;
  civilite: string;
  nom_contact: string;
  plage_horaire_livraison: string;
  livraison_offerte: boolean;
}

interface UseOrderConfirmationOptions {
  onClose: () => void;
  onSuccess: () => void;
}

export function useOrderConfirmation({ onClose, onSuccess }: UseOrderConfirmationOptions) {
  const { items, total, clearCart } = useCart();
  const { currentProspect, createVente, updateProspect } = useProspect();
  const { currentCampaign } = useCampaign();
  const campaignId = currentCampaign?.id_campagne;
  const hasCigalesShipping = campaignId === 7;
  const defaultDeliveryDelay = hasCigalesShipping ? 2 : 3;
  const { user } = useUser();
  const {
    currentAppelId,
    currentAppelProspectId,
    currentOrigineAppel,
    currentRendezVousSourceId,
    callDuration,
  } = useDialer();

  const availableModesPaiement = useMemo<ModePaiement[]>(
    () => currentCampaign
      ? (currentCampaign.modes_paiement ?? [])
      : ['Prelevement', 'Cheque', 'Virement'],
    [currentCampaign],
  );

  const [formData, setFormData] = useState<FormData>({
    raison_sociale_facturation: currentProspect?.raison_sociale || '',
    adresse_facturation: currentProspect?.adresse_facturation || '',
    adresse_livraison: getProspectDeliveryPrefill(currentProspect).adresse,
    code_postal_facturation: currentProspect?.code_postal || '',
    code_postal_livraison: getProspectDeliveryPrefill(currentProspect).code_postal,
    ville_facturation: currentProspect?.ville || '',
    ville_livraison: getProspectDeliveryPrefill(currentProspect).ville,
    pays_facturation: currentProspect?.pays || 'France',
    pays_livraison: currentProspect?.pays || 'France',
    meme_adresse: !currentProspect?.adresse_livraison || currentProspect?.adresse_livraison === currentProspect?.adresse_facturation,
    mode_paiement: availableModesPaiement[0] || '',
    notes: '',
    siret: currentProspect?.siret || '',
    email: currentProspect?.email || '',
    raison_sociale: currentProspect?.raison_sociale || '',
    raison_sociale_livraison: currentProspect?.raison_sociale_livraison || (
      (!currentProspect?.adresse_livraison || currentProspect?.adresse_livraison === currentProspect?.adresse_facturation)
        ? (currentProspect?.raison_sociale || '')
        : ''
    ),
    delais_livraison: defaultDeliveryDelay,
    delai_facturation: 30,
    civilite: currentProspect?.civilite || '',
    nom_contact: `${currentProspect?.prenom || ''} ${currentProspect?.nom || ''}`.trim(),
    plage_horaire_livraison: '',
    livraison_offerte: false,
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      delais_livraison: defaultDeliveryDelay,
      delai_facturation: 30,
      livraison_offerte: false,
    }));
  }, [campaignId, defaultDeliveryDelay]);

  const deliveryDelays = hasCigalesShipping ? CIGALES_DELIVERY_DELAYS : DELIVERY_DELAYS;
  const shippingCost = hasCigalesShipping && total < 300 && !formData.livraison_offerte ? 30 : 0;
  const totalHT = total + shippingCost;
  const totalTTC = totalHT * 1.2;
  const shippingLabel = shippingCost > 0 ? formatCurrency(shippingCost)
    : total < 300 && formData.livraison_offerte ? 'Offerts (geste commercial)' : 'Offerts';

  // Met à jour le formData quand le prospect change
  useEffect(() => {
    if (currentProspect) {
      setFormData(prev => ({
        ...prev,
        raison_sociale_facturation: currentProspect.raison_sociale || '',
        adresse_facturation: currentProspect.adresse_facturation || '',
        adresse_livraison: getProspectDeliveryPrefill(currentProspect).adresse,
        code_postal_facturation: currentProspect.code_postal || '',
        code_postal_livraison: getProspectDeliveryPrefill(currentProspect).code_postal,
        ville_facturation: currentProspect.ville || '',
        ville_livraison: getProspectDeliveryPrefill(currentProspect).ville,
        pays_facturation: currentProspect.pays || 'France',
        pays_livraison: currentProspect.pays || 'France',
        siret: currentProspect.siret || '',
        email: currentProspect.email || '',
        raison_sociale: currentProspect.raison_sociale || '',
        raison_sociale_livraison: currentProspect.raison_sociale_livraison || (
          prev.meme_adresse ? (currentProspect.raison_sociale || '') : (prev.raison_sociale_livraison || '')
        ),
        civilite: prev.civilite || currentProspect.civilite || '',
        nom_contact: prev.nom_contact || `${currentProspect.prenom || ''} ${currentProspect.nom || ''}`.trim(),
      }));
    }
  }, [currentProspect]);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.mode_paiement && availableModesPaiement.includes(prev.mode_paiement)) {
        return prev;
      }

      return {
        ...prev,
        mode_paiement: availableModesPaiement[0] || '',
      };
    });
  }, [availableModesPaiement]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof FormData, value: string | boolean | number) => {
    const updatedValue = value;

    // Si la checkbox "meme_adresse" est cochée, copier uniquement l'adresse de facturation vers la livraison.
    // Les raisons sociales restent indépendantes même à une adresse identique.
    if (field === 'meme_adresse' && updatedValue === true) {
      setFormData(prev => ({
        ...prev,
        meme_adresse: true,
        adresse_livraison: prev.adresse_facturation,
        code_postal_livraison: prev.code_postal_facturation,
        ville_livraison: prev.ville_facturation,
        pays_livraison: prev.pays_facturation,
      }));
      return;
    }

    // Si la checkbox "meme_adresse" est décochée, effacer uniquement l'adresse de livraison.
    if (field === 'meme_adresse' && updatedValue === false) {
      setFormData(prev => ({
        ...prev,
        meme_adresse: false,
        adresse_livraison: '',
        code_postal_livraison: '',
        ville_livraison: '',
        pays_livraison: 'France',
      }));
      return;
    }

    setFormData(prev => {
      if (
        typeof updatedValue === 'string'
        && (field === 'raison_sociale' || field === 'raison_sociale_facturation' || field === 'raison_sociale_livraison')
      ) {
        return synchronizeOrderCompanyNames(prev, field, updatedValue);
      }

      const next = { ...prev, [field]: updatedValue };
      // Si on modifie l'adresse de facturation et que meme_adresse est coché, copier vers livraison
      if (prev.meme_adresse) {
        if (field === 'adresse_facturation') next.adresse_livraison = updatedValue as string;
        if (field === 'code_postal_facturation') next.code_postal_livraison = updatedValue as string;
        if (field === 'ville_facturation') next.ville_livraison = updatedValue as string;
        if (field === 'pays_facturation') next.pays_livraison = updatedValue as string;
      }
      return next;
    });

    if (validationErrors[field as string]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const handleSelectAddressFacturation = (result: AddressSelectionResult) => {
    setFormData(prev => {
      const next = {
        ...prev,
        adresse_facturation: result.adresse,
        code_postal_facturation: result.code_postal,
        ville_facturation: result.ville,
        pays_facturation: result.pays,
      };
      if (prev.meme_adresse) {
        next.adresse_livraison = result.adresse;
        next.code_postal_livraison = result.code_postal;
        next.ville_livraison = result.ville;
        next.pays_livraison = result.pays;
      }
      return next;
    });

    setValidationErrors(prev => {
      const next = { ...prev };
      delete next.adresse_facturation;
      delete next.code_postal_facturation;
      delete next.ville_facturation;
      delete next.pays_facturation;
      if (formData.meme_adresse) {
        delete next.adresse_livraison;
        delete next.code_postal_livraison;
        delete next.ville_livraison;
        delete next.pays_livraison;
      }
      return next;
    });
  };

  const handleSelectAddressLivraison = (result: AddressSelectionResult) => {
    setFormData(prev => ({
      ...prev,
      adresse_livraison: result.adresse,
      code_postal_livraison: result.code_postal,
      ville_livraison: result.ville,
      pays_livraison: result.pays,
    }));

    setValidationErrors(prev => {
      const next = { ...prev };
      delete next.adresse_livraison;
      delete next.code_postal_livraison;
      delete next.ville_livraison;
      delete next.pays_livraison;
      return next;
    });
  };

  const handleProspectInfoUpdate = async (updatedFields: Partial<typeof formData>) => {
    if (!currentProspect) return;

    const prospectUpdates: {
      siret?: string;
      email?: string;
      raison_sociale?: string;
      raison_sociale_livraison?: string;
      adresse_facturation?: string;
      adresse_livraison?: string;
      code_postal?: string;
      ville?: string;
      pays?: string;
      civilite?: string;
      nom?: string;
      prenom?: string;
    } = {};

    // Mapper les champs du form vers les champs du prospect
    if (updatedFields.siret !== undefined) prospectUpdates.siret = updatedFields.siret.trim();
    if (updatedFields.email !== undefined) prospectUpdates.email = updatedFields.email.trim();
    if (updatedFields.raison_sociale !== undefined) prospectUpdates.raison_sociale = updatedFields.raison_sociale.trim();
    if (updatedFields.raison_sociale_livraison !== undefined) prospectUpdates.raison_sociale_livraison = updatedFields.raison_sociale_livraison.trim();
    if (updatedFields.adresse_facturation !== undefined) prospectUpdates.adresse_facturation = capitalizeAddress(updatedFields.adresse_facturation);
    if (updatedFields.adresse_livraison !== undefined) {
      const deliveryStreet = updatedFields.adresse_livraison;
      const deliveryLocality = [updatedFields.code_postal_livraison, updatedFields.ville_livraison].filter(Boolean).join(' ');
      const deliveryAddress = deliveryStreet && !updatedFields.meme_adresse
        ? [deliveryStreet, deliveryLocality].filter(Boolean).join(', ')
        : deliveryStreet;
      prospectUpdates.adresse_livraison = capitalizeAddress(deliveryAddress);
    }
    if (updatedFields.code_postal_facturation !== undefined) prospectUpdates.code_postal = updatedFields.code_postal_facturation.trim();
    if (updatedFields.ville_facturation !== undefined) prospectUpdates.ville = updatedFields.ville_facturation.trim();
    if (updatedFields.pays_facturation !== undefined) prospectUpdates.pays = updatedFields.pays_facturation.trim();
    if (updatedFields.civilite !== undefined) prospectUpdates.civilite = updatedFields.civilite.trim();
    if (updatedFields.nom_contact !== undefined) {
      const nameParts = updatedFields.nom_contact.trim().split(/\s+/);
      const prenom = nameParts.length > 1 ? nameParts[0] : '';
      const nom = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];
      prospectUpdates.nom = nom;
      prospectUpdates.prenom = prenom;
    }

    // Ne mettre à jour que si il y a des changements
    const hasChanges = Object.keys(prospectUpdates).length > 0;
    if (!hasChanges) return;

    try {
      await updateProspect(prospectUpdates);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du prospect:', err);
      // Ne pas bloquer le formulaire, juste logger l'erreur
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors = validateOrderForm(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    if (!currentProspect || !currentCampaign || !user) {
      setError('Informations manquantes (prospect, campagne ou utilisateur)');
      return;
    }

    if (items.length === 0) {
      setError('Le panier est vide');
      return;
    }

    if (!formData.mode_paiement) {
      setError('Aucun mode de paiement n’est autorisé pour cette campagne');
      return;
    }

    setIsSubmitting(true);

    try {
      // Mettre à jour les infos du prospect avec les champs SAISIS (siret, email, raison_sociale, adresses)
      await handleProspectInfoUpdate(formData);

      const appelId = currentAppelProspectId === currentProspect.id_prospect
        ? currentAppelId ?? undefined
        : undefined;

      const venteData = buildVentePayload({
        prospectId: currentProspect.id_prospect,
        campagneId: currentCampaign.id_campagne,
        appelId,
        formData,
        items,
      });

      const createdVente = await createVente(venteData);
      const saleProspectId = createdVente.id_prospect || currentProspect.id_prospect;
      const closingAppelId = createdVente.id_appel
        ?? (currentAppelProspectId === saleProspectId ? currentAppelId ?? undefined : undefined);

      const prospectName = currentProspect.prenom
        ? `${currentProspect.prenom} ${currentProspect.nom}`
        : currentProspect.nom;

      closingService.savePending({
        prospectId: saleProspectId,
        prospectName,
        campagneId: currentCampaign.id_campagne,
        campaignVariant: getCampaignVariant(currentCampaign),
        appelId: closingAppelId,
        origineAppel: currentOrigineAppel ?? undefined,
        rendezVousSourceId: currentRendezVousSourceId ?? undefined,
        dureeAppel: callDuration,
      });

      clearCart();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Erreur lors de la création de la vente:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la création de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    items,
    totalHT,
    totalTTC,
    shippingLabel,
    hasCigalesShipping,
    deliveryDelays,
    availableModesPaiement,
    formData,
    isSubmitting,
    error,
    validationErrors,
    handleInputChange,
    handleSelectAddressFacturation,
    handleSelectAddressLivraison,
    handleSubmit,
    handleProspectInfoUpdate,
  };
}
