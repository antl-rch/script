import './historiqueAppels.scss';

import { useEffect } from 'react';
import { useCallNotesDraft, useCampaign, useDialer, useFgaProspectNote, useProspect } from '../../../hooks/index.ts';
import { Loader } from '../loader/index.ts';
import { ErrorMessage } from '../errorMessage/index.ts';
import AppelCard from './AppelCard';
import { formatDateTime, getCampaignUiConfig, supportsStandaloneProspectNotes } from '../../../utils/scripts/index.ts';

export default function HistoriqueAppels() {
  const {
    currentProspect,
    appels,
    appelsLoading,
    appelsError,
    appelsPagination,
    loadAppels,
    clearAppelsError,
  } = useProspect();
  const { currentCampaign } = useCampaign();
  const { currentAppelId, currentOrigineAppel, statut } = useDialer();
  const { notes: callNotes, setNotes: setCallNotes } = useCallNotesDraft(currentAppelId);
  const isFgaCampaign = supportsStandaloneProspectNotes(currentCampaign?.id_campagne);
  const {
    notes: fgaNotes,
    setNotes: setFgaNotes,
    saveNotes: saveFgaNotes,
    isLoading: isFgaNoteLoading,
    isSaving: isFgaNoteSaving,
    isDirty: isFgaNoteDirty,
    error: fgaNoteError,
  } = useFgaProspectNote(currentProspect?.id_prospect, currentCampaign?.id_campagne);

  useEffect(() => {
    if (currentProspect) {
      loadAppels();
    }
  }, [currentProspect, loadAppels]);

  const handlePreviousPage = () => {
    if (appelsPagination.page > 1) {
      loadAppels(appelsPagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (appelsPagination.page < appelsPagination.totalPages) {
      loadAppels(appelsPagination.page + 1);
    }
  };

  const grilleTarifaireEnvoyeeAt = currentProspect?.grille_tarifaire_envoyee_at ?? null;
  const plaquetteEnvoyeeAt = currentProspect?.plaquette_envoyee_at ?? null;
  const fgaPresentationEnvoyeeAt = currentProspect?.fga_presentation_envoyee_at ?? null;
  const { actions } = getCampaignUiConfig(currentCampaign);
  const showTarifs = actions.some(({ id }) => id === 'tarifs');
  const showPlaquette = actions.some(({ id }) => id === 'plaquette');
  const isLiveCall = statut === 'appel_sortant'
    || statut === 'en_appel'
    || statut === 'qualification_en_cours'
    || statut === 'svi_a_naviguer';
  const canDraftCurrentCallNotes = currentAppelId !== null
    && !isFgaCampaign
    && isLiveCall
    && (currentOrigineAppel === 'auto' || currentOrigineAppel === 'rappel');
  const grilleTarifaireLabel = grilleTarifaireEnvoyeeAt
    ? `Grille tarifaire envoyee le ${formatDateTime(grilleTarifaireEnvoyeeAt)}`
    : 'Grille tarifaire non envoyee';
  const plaquetteLabel = plaquetteEnvoyeeAt
    ? `Plaquette envoyee le ${formatDateTime(plaquetteEnvoyeeAt)}`
    : 'Plaquette non envoyee';
  const fgaPresentationLabel = fgaPresentationEnvoyeeAt
    ? `Présentation envoyée le ${formatDateTime(fgaPresentationEnvoyeeAt)}`
    : 'Présentation non envoyée';

  if (appelsLoading) {
    return (
      <div className="historique-appels">
        <div className="historique-appels__loader">
          <Loader size="large" />
          <p>Chargement de l'historique...</p>
        </div>
      </div>
    );
  }

  if (appelsError) {
    return (
      <div className="historique-appels">
        <ErrorMessage message={appelsError} onClose={clearAppelsError} />
      </div>
    );
  }

  return (
    <div className="historique-appels">
      <div className="historique-appels__header">
        <h2>Historique des appels</h2>
        <div className="historique-appels__header-meta">
          {showTarifs && (
            <span className={`historique-appels__tarifs ${grilleTarifaireEnvoyeeAt ? 'historique-appels__tarifs--sent' : 'historique-appels__tarifs--pending'}`}>
              {grilleTarifaireLabel}
            </span>
          )}
          {showPlaquette && (
            <span className={`historique-appels__tarifs ${plaquetteEnvoyeeAt ? 'historique-appels__tarifs--sent' : 'historique-appels__tarifs--pending'}`}>
              {plaquetteLabel}
            </span>
          )}
          {currentProspect?.script_document_dispatches?.map((dispatch) => (
            <span key={dispatch.id_prospect_document_dispatch} className="historique-appels__tarifs historique-appels__tarifs--sent">
              {dispatch.script_document?.label ?? 'Plaquette'} · {dispatch.attachment_filename}
              {dispatch.script_document ? ` · Version ${dispatch.script_document.revision}` : ''}
              {' · '}{formatDateTime(dispatch.sent_at)}
            </span>
          ))}
          {isFgaCampaign && (
            <span className={`historique-appels__tarifs ${fgaPresentationEnvoyeeAt ? 'historique-appels__tarifs--sent' : 'historique-appels__tarifs--pending'}`}>
              {fgaPresentationLabel}
            </span>
          )}
          <span className="historique-appels__count">
            {appelsPagination.total} appel{appelsPagination.total > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {canDraftCurrentCallNotes && (
        <div className="historique-appels__current-call-notes">
          <label htmlFor="current-call-notes">Notes de l'appel en cours</label>
          <textarea
            id="current-call-notes"
            value={callNotes}
            onChange={(event) => setCallNotes(event.target.value)}
            placeholder="Commencez le traçage pendant l'appel : objections, informations et prochaines étapes..."
            rows={5}
          />
          <p>Ce commentaire sera repris dans la modale de closing.</p>
        </div>
      )}

      {isFgaCampaign && (
        <div className="historique-appels__current-call-notes historique-appels__current-call-notes--fga">
          <label htmlFor="fga-prospect-notes">Note de suivi FGA Consulting</label>
          <textarea
            id="fga-prospect-notes"
            value={fgaNotes}
            onChange={(event) => setFgaNotes(event.target.value)}
            placeholder="Préparez l’appel ou consignez un suivi réalisé sans appel..."
            rows={5}
            maxLength={10000}
            disabled={isFgaNoteLoading || isFgaNoteSaving}
          />
          <div className="historique-appels__note-actions">
            <p>
              {isLiveCall
                ? 'Cette note sera reprise dans le closing et rattachée à l’appel.'
                : 'Cette note est indépendante d’un appel et reste disponible dans le calendrier.'}
            </p>
            <button
              type="button"
              onClick={() => void saveFgaNotes().catch(() => undefined)}
              disabled={isFgaNoteLoading || isFgaNoteSaving || !isFgaNoteDirty}
            >
              {isFgaNoteSaving ? 'Enregistrement...' : (isFgaNoteDirty ? 'Enregistrer la note' : 'Note enregistrée')}
            </button>
          </div>
          {fgaNoteError && <p className="historique-appels__note-error">{fgaNoteError}</p>}
        </div>
      )}

      <div className="historique-appels__list">
        {appels.length === 0 ? (
          <div className="historique-appels__empty">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <h3>Aucun appel enregistre</h3>
            <p>Ce prospect n'a pas encore ete contacte.</p>
          </div>
        ) : appels.map((appel) => (
          <AppelCard key={appel.id_appel} appel={appel} />
        ))}
      </div>

      {appelsPagination.totalPages > 1 && (
        <div className="historique-appels__pagination">
          <button
            className="pagination__btn"
            onClick={handlePreviousPage}
            disabled={appelsPagination.page === 1}
          >
            Precedent
          </button>
          <span className="pagination__info">
            Page {appelsPagination.page} sur {appelsPagination.totalPages}
          </span>
          <button
            className="pagination__btn"
            onClick={handleNextPage}
            disabled={appelsPagination.page === appelsPagination.totalPages}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
