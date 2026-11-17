import './landingPage.scss';
import { useLandingPage } from '../../../hooks/index.ts';
import {
  ActionButtons,
  AgentCalendar,
  CatalogueProduits,
  ConfirmOrderModal,
  ErrorMessage,
  FgaPresentationPreviewModal,
  HistoriqueAppels,
  HistoriqueRendezVous,
  HistoriqueVentes,
  Loader,
  Panier,
  PriseRendezVousPlaceholder,
  ProspectInfoHeader,
  QuiEstCe,
  QuiSommesNous,
} from '../../components';

export default function LandingPage() {
  const {
    prospectFullName,
    currentProspect, currentView, isLoading, error, clearError,
    isModalOpen, setIsModalOpen,
    isFgaPresentationPreviewOpen, previewDocument, handleFgaPresentationPreviewSend, handleFgaPresentationPreviewCancel,
    handlePlanAppels, handleObjections,
    handleOrderSuccess,
    setView, currentCampaign, campaignUi, isTestMode, handleAction,
  } = useLandingPage();

  if (isLoading) {
    return (
      <main id="landingPage">
        <div className="landing-page__loader">
          <Loader size="large" />
          <p>Chargement du prospect...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="landingPage">
        <div className="landing-page__error">
          <ErrorMessage message={error} onClose={clearError} />
        </div>
      </main>
    );
  }

  if (!currentProspect) {
    return (
      <main id="landingPage">
        <div className="landing-page__empty">
          <p>Aucun prospect chargé</p>
        </div>
      </main>
    );
  }

  return (
    <main id="landingPage">
      <ProspectInfoHeader
        currentView={currentView}
        onQuiEstCe={() => setView('qui-est-ce')}
        onPlanAppels={handlePlanAppels}
        onObjections={handleObjections}
        onQuiSommesNous={() => setView('qui-sommes-nous')}
        isTestMode={isTestMode}
      />

      <div className="landing-page__workspace">
        <div className="landing-page__main">
          <ActionButtons
            currentView={currentView}
            buttons={campaignUi.actions}
            onAction={handleAction}
          />

          <div className={`landing-page__content ${currentView === 'commande' ? 'view-commande' : ''}`}>
            {currentView === 'qui-est-ce' && <QuiEstCe />}
            {currentView === 'qui-sommes-nous' && <QuiSommesNous />}
            {currentView === 'historique-appels' && <HistoriqueAppels />}
            {currentView === 'historique-offres' && <HistoriqueVentes />}
            {currentView === 'historique-rendez-vous' && <HistoriqueRendezVous />}
            {currentView === 'rendez-vous' && (
              <AgentCalendar
                prospectId={currentProspect.id_prospect}
                prospectName={prospectFullName}
                campagneId={currentCampaign?.id_campagne}
              />
            )}
            {campaignUi.commandeMode === 'sales' && currentView === 'commande' && (
                <div className="landing-page__commande">
                  <div className="landing-page__catalogue">
                    <CatalogueProduits />
                  </div>
                  <div className="landing-page__panier">
                    <Panier onValidateOrder={() => setIsModalOpen(true)} />
                  </div>
                </div>
            )}
            {campaignUi.commandeMode === 'placeholder' && (
              <div className="landing-page__lead-order" hidden={currentView !== 'commande'}>
                <PriseRendezVousPlaceholder />
              </div>
            )}
          </div>
        </div>
      </div>

      {campaignUi.commandeMode === 'sales' && (
        <ConfirmOrderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleOrderSuccess}
        />
      )}

      <FgaPresentationPreviewModal
        isOpen={isFgaPresentationPreviewOpen}
        document={previewDocument}
        prospect={currentProspect}
        onSend={handleFgaPresentationPreviewSend}
        onCancel={handleFgaPresentationPreviewCancel}
      />
    </main>
  );
}
