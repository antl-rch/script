import './confirmOrderModal.scss';
import { FaTimes, FaCheck, FaSpinner, FaShoppingCart, FaMapMarkerAlt, FaCreditCard, FaStickyNote, FaBuilding, FaClock, FaUser } from 'react-icons/fa';
import type { ModePaiement } from '../../../utils/types/index.ts';
import { formatCurrency, calculateLineTotal } from '../../../utils/scripts/index.ts';
import { useOrderConfirmation } from '../../../hooks/index.ts';
import { Button } from '../button/index.ts';
import { AddressAutocomplete } from '../addressAutocomplete/index.ts';
import Select from 'react-select';

const PAYMENT_LABELS: Record<ModePaiement, string> = {
  CB: 'Carte bancaire (par téléphone)',
  Prelevement: 'Prélèvement automatique',
  Cheque: 'Chèque bancaire',
  Virement: 'Virement bancaire',
};

interface ConfirmOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfirmOrderModal({ isOpen, onClose, onSuccess }: ConfirmOrderModalProps) {
  const {
    items, totalHT, totalTTC, hasCigalesShipping, shippingLabel, deliveryDelays, availableModesPaiement,
    formData, isSubmitting, error, validationErrors,
    handleInputChange, handleSelectAddressFacturation, handleSelectAddressLivraison, handleSubmit,
  } = useOrderConfirmation({ onClose, onSuccess });

  if (!isOpen) return null;

  const deliveryOptions = deliveryDelays.map((value) => ({ value, label: `${value} semaines` }));

  return (
    <div className="confirm-order-modal__overlay" onClick={onClose}>
      <div className="confirm-order-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-order-modal__header">
          <h2>Finalisation de la commande</h2>
          <button
            type="button"
            className="confirm-order-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="confirm-order-modal__form">
          {error && <div className="confirm-order-modal__error">{error}</div>}

          <div className="confirm-order-modal__two-columns">
            <div className="confirm-order-modal__left-col">
              <div className="confirm-order-modal__section">
                <h3><FaUser /> Contact de la commande</h3>
                <div className="confirm-order-modal__form-grid">
                  <div className="confirm-order-modal__form-group">
                    <label htmlFor="civilite">Civilité *</label>
                    <select
                      id="civilite"
                      value={formData.civilite}
                      onChange={(e) => handleInputChange('civilite', e.target.value)}
                      disabled={isSubmitting}
                      className={`confirm-order-modal__select-standard ${validationErrors.civilite ? 'input-error' : ''}`}
                    >
                      <option value="">Sélectionner...</option>
                      <option value="M.">M.</option>
                      <option value="Mme">Mme</option>
                    </select>
                    {validationErrors.civilite && <span className="error-message">{validationErrors.civilite}</span>}
                  </div>

                  <div className="confirm-order-modal__form-group">
                    <label htmlFor="nom_contact">Nom *</label>
                    <input
                      type="text"
                      id="nom_contact"
                      value={formData.nom_contact}
                      onChange={(e) => handleInputChange('nom_contact', e.target.value)}
                      disabled={isSubmitting}
                      className={validationErrors.nom_contact ? 'input-error' : ''}
                    />
                    {validationErrors.nom_contact && <span className="error-message">{validationErrors.nom_contact}</span>}
                  </div>
                </div>
              </div>

              <div className="confirm-order-modal__section">
                <h3><FaBuilding /> Informations du prospect</h3>
                <div className="confirm-order-modal__form-grid">
                  <div className="confirm-order-modal__form-group">
                    <label htmlFor="raison_sociale">Raison sociale</label>
                    <input
                      type="text"
                      id="raison_sociale"
                      value={formData.raison_sociale}
                      onChange={(e) => handleInputChange('raison_sociale', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="confirm-order-modal__form-group">
                    <label htmlFor="siret">SIRET</label>
                    <input
                      type="text"
                      id="siret"
                      value={formData.siret}
                      onChange={(e) => handleInputChange('siret', e.target.value)}
                      disabled={isSubmitting}
                      maxLength={14}
                    />
                  </div>

                  <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                    <label htmlFor="email">Mail</label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                    <label htmlFor="delais_livraison"><FaClock /> Délai de livraison</label>
                    <Select
                      inputId="delais_livraison"
                      value={deliveryOptions.find(opt => opt.value === formData.delais_livraison)}
                      onChange={(selected) => selected && handleInputChange('delais_livraison', selected.value)}
                      options={deliveryOptions}
                      isDisabled={isSubmitting}
                      className="confirm-order-modal__select"
                      classNamePrefix="react-select"
                    />
                  </div>

                  <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                    <label htmlFor="plage_horaire_livraison">Plages horaires de livraison (champ libre)</label>
                    <input
                      type="text"
                      id="plage_horaire_livraison"
                      placeholder="Ex: Pas de livraison le vendredi après-midi, jamais le matin..."
                      value={formData.plage_horaire_livraison}
                      onChange={(e) => handleInputChange('plage_horaire_livraison', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div className="confirm-order-modal__section">
                <h3><FaMapMarkerAlt /> Adresse de facturation</h3>
                <div className="confirm-order-modal__form-grid">
                  <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                    <label htmlFor="raison_sociale_facturation">Raison sociale</label>
                    <input
                      type="text"
                      id="raison_sociale_facturation"
                      value={formData.raison_sociale_facturation}
                      onChange={(e) => handleInputChange('raison_sociale_facturation', e.target.value)}
                      disabled={isSubmitting}
                      maxLength={255}
                    />
                  </div>

                  <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                    <AddressAutocomplete
                      id="adresse_facturation"
                      label="Adresse"
                      value={formData.adresse_facturation}
                      onChange={(val) => handleInputChange('adresse_facturation', val)}
                      onSelectAddress={handleSelectAddressFacturation}
                      disabled={isSubmitting}
                      required
                      error={validationErrors.adresse_facturation}
                      placeholder="Rechercher une adresse de facturation (ex: 10 rue de la paix 75002)..."
                    />
                  </div>

                  <div className="confirm-order-modal__form-group">
                    <label htmlFor="code_postal_facturation">Code postal *</label>
                    <input
                      type="text"
                      id="code_postal_facturation"
                      value={formData.code_postal_facturation}
                      onChange={(e) => handleInputChange('code_postal_facturation', e.target.value)}
                      disabled={isSubmitting}
                      maxLength={5}
                      className={validationErrors.code_postal_facturation ? 'input-error' : ''}
                    />
                    {validationErrors.code_postal_facturation && <span className="error-message">{validationErrors.code_postal_facturation}</span>}
                  </div>

                  <div className="confirm-order-modal__form-group">
                    <label htmlFor="ville_facturation">Ville *</label>
                    <input
                      type="text"
                      id="ville_facturation"
                      value={formData.ville_facturation}
                      onChange={(e) => handleInputChange('ville_facturation', e.target.value)}
                      disabled={isSubmitting}
                      className={validationErrors.ville_facturation ? 'input-error' : ''}
                    />
                    {validationErrors.ville_facturation && <span className="error-message">{validationErrors.ville_facturation}</span>}
                  </div>

                  <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                    <label htmlFor="pays_facturation">Pays *</label>
                    <input
                      type="text"
                      id="pays_facturation"
                      value={formData.pays_facturation}
                      onChange={(e) => handleInputChange('pays_facturation', e.target.value)}
                      disabled={isSubmitting}
                      className={validationErrors.pays_facturation ? 'input-error' : ''}
                    />
                    {validationErrors.pays_facturation && <span className="error-message">{validationErrors.pays_facturation}</span>}
                  </div>
                </div>
              </div>

              <div className="confirm-order-modal__section">
                <h3><FaMapMarkerAlt /> Informations de livraison</h3>
                <div className="confirm-order-modal__checkbox-group">
                  <input
                    type="checkbox"
                    id="meme_adresse"
                    checked={formData.meme_adresse}
                    onChange={(e) => handleInputChange('meme_adresse', e.target.checked)}
                    disabled={isSubmitting}
                  />
                  <label htmlFor="meme_adresse">L'adresse de livraison est la même que l'adresse de facturation</label>
                </div>



                <div className="confirm-order-modal__delivery-section">
                  <div className="confirm-order-modal__form-grid">
                    <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                      <label htmlFor="raison_sociale_livraison">Raison sociale</label>
                      <input
                        type="text"
                        id="raison_sociale_livraison"
                        value={formData.raison_sociale_livraison}
                        onChange={(e) => handleInputChange('raison_sociale_livraison', e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                      {formData.meme_adresse ? (
                        <>
                          <label htmlFor="adresse_livraison">Adresse (identique)</label>
                          <input
                            type="text"
                            id="adresse_livraison"
                            value={formData.adresse_facturation}
                            disabled
                          />
                        </>
                      ) : (
                        <AddressAutocomplete
                          id="adresse_livraison"
                          label="Adresse"
                          value={formData.adresse_livraison}
                          onChange={(val) => handleInputChange('adresse_livraison', val)}
                          onSelectAddress={handleSelectAddressLivraison}
                          disabled={isSubmitting}
                          required
                          error={validationErrors.adresse_livraison}
                          placeholder="Rechercher une adresse de livraison..."
                        />
                      )}
                    </div>

                    <div className="confirm-order-modal__form-group">
                      <label htmlFor="code_postal_livraison">Code postal {formData.meme_adresse ? '(identique)' : '*'}</label>
                      <input
                        type="text"
                        id="code_postal_livraison"
                        value={formData.meme_adresse ? formData.code_postal_facturation : formData.code_postal_livraison}
                        onChange={(e) => handleInputChange('code_postal_livraison', e.target.value)}
                        disabled={isSubmitting || formData.meme_adresse}
                        maxLength={5}
                        className={validationErrors.code_postal_livraison && !formData.meme_adresse ? 'input-error' : ''}
                      />
                      {validationErrors.code_postal_livraison && !formData.meme_adresse && <span className="error-message">{validationErrors.code_postal_livraison}</span>}
                    </div>

                    <div className="confirm-order-modal__form-group">
                      <label htmlFor="ville_livraison">Ville {formData.meme_adresse ? '(identique)' : '*'}</label>
                      <input
                        type="text"
                        id="ville_livraison"
                        value={formData.meme_adresse ? formData.ville_facturation : formData.ville_livraison}
                        onChange={(e) => handleInputChange('ville_livraison', e.target.value)}
                        disabled={isSubmitting || formData.meme_adresse}
                        className={validationErrors.ville_livraison && !formData.meme_adresse ? 'input-error' : ''}
                      />
                      {validationErrors.ville_livraison && !formData.meme_adresse && <span className="error-message">{validationErrors.ville_livraison}</span>}
                    </div>

                    <div className="confirm-order-modal__form-group confirm-order-modal__form-group--full">
                      <label htmlFor="pays_livraison">Pays {formData.meme_adresse ? '(identique)' : '*'}</label>
                      <input
                        type="text"
                        id="pays_livraison"
                        value={formData.meme_adresse ? formData.pays_facturation : formData.pays_livraison}
                        onChange={(e) => handleInputChange('pays_livraison', e.target.value)}
                        disabled={isSubmitting || formData.meme_adresse}
                        className={validationErrors.pays_livraison && !formData.meme_adresse ? 'input-error' : ''}
                      />
                      {validationErrors.pays_livraison && !formData.meme_adresse && <span className="error-message">{validationErrors.pays_livraison}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="confirm-order-modal__right-col">
              <div className="confirm-order-modal__section">
                <h3><FaShoppingCart /> Récapitulatif du panier</h3>
                <div className="confirm-order-modal__cart-items">
                  {items.map((item) => {
                    const sousTotal = calculateLineTotal(item.prix_unitaire, item.quantite, item.remise);
                    const isPanierLine = item.item_type === 'panier';
                    return (
                      <div key={item.produit.id_produit} className="confirm-order-modal__cart-item">
                        <div className="confirm-order-modal__cart-item-info">
                          <span className="confirm-order-modal__cart-item-name">
                            {isPanierLine ? (item.panier_label || item.produit.nom_produit) : item.produit.nom_produit}
                          </span>
                          {isPanierLine && item.panier_produits && item.panier_produits.length > 0 && (
                            <span className="confirm-order-modal__cart-item-quantity">
                              {item.panier_produits.length} article{item.panier_produits.length > 1 ? 's' : ''} inclus
                            </span>
                          )}
                          <span className="confirm-order-modal__cart-item-quantity">x{item.quantite}</span>
                        </div>
                        <div className="confirm-order-modal__cart-item-price">
                          {item.remise > 0 && (
                            <span className="confirm-order-modal__cart-item-remise">-{formatCurrency(item.remise)}</span>
                          )}
                          <span className="confirm-order-modal__cart-item-total">{formatCurrency(sousTotal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="confirm-order-modal__cart-total">
                  <div className="confirm-order-modal__cart-total-row">
                    <span>Total HT</span>
                    <strong>{formatCurrency(totalHT)}</strong>
                  </div>
                  {hasCigalesShipping && (
                    <div className="confirm-order-modal__cart-total-row confirm-order-modal__cart-total-row--muted">
                      <span>dont livraison</span>
                      <span>{shippingLabel}</span>
                    </div>
                  )}
                  <div className="confirm-order-modal__cart-total-row confirm-order-modal__cart-total-row--ttc">
                    <span>Total TTC</span>
                    <strong>{formatCurrency(totalTTC)}</strong>
                  </div>
                </div>

                {hasCigalesShipping && (
                  <div className="confirm-order-modal__checkbox-group" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #e5e7eb' }}>
                    <input
                      type="checkbox"
                      id="livraison_offerte"
                      checked={formData.livraison_offerte}
                      onChange={(e) => handleInputChange('livraison_offerte', e.target.checked)}
                      disabled={isSubmitting}
                    />
                    <label htmlFor="livraison_offerte">Offrir la livraison (geste commercial)</label>
                  </div>
                )}
              </div>

              <div className="confirm-order-modal__section">
                <h3><FaCreditCard /> Mode de paiement</h3>
                {availableModesPaiement.length === 0 ? (
                  <div className="confirm-order-modal__error">
                    Aucun mode de paiement n’est autorisé pour cette campagne.
                  </div>
                ) : (
                  <div className="confirm-order-modal__payment-options">
                    {availableModesPaiement.map((mode) => (
                      <label key={mode} className="confirm-order-modal__payment-option">
                        <input
                          type="radio"
                          name="mode_paiement"
                          value={mode}
                          checked={formData.mode_paiement === mode}
                          onChange={(e) => handleInputChange('mode_paiement', e.target.value as ModePaiement)}
                          disabled={isSubmitting}
                        />
                        <span>{PAYMENT_LABELS[mode]}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="confirm-order-modal__form-group confirm-order-modal__billing-delay">
                  <label htmlFor="delai_facturation">Délai de facturation</label>
                  <select
                    id="delai_facturation"
                    className="confirm-order-modal__select-standard"
                    value={formData.delai_facturation}
                    onChange={(e) => handleInputChange('delai_facturation', Number(e.target.value))}
                    disabled={isSubmitting}
                  >
                    <option value={30}>30 jours</option>
                    <option value={45}>45 jours</option>
                  </select>
                </div>
              </div>

              <div className="confirm-order-modal__section">
                <h3><FaStickyNote /> Notes complémentaires</h3>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Ajouter des notes ou commentaires sur cette commande..."
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          <div className="confirm-order-modal__footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || availableModesPaiement.length === 0}>
              {isSubmitting ? (
                <><FaSpinner className="spinner" /> Envoi en cours...</>
              ) : (
                <><FaCheck /> Confirmer la commande</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
