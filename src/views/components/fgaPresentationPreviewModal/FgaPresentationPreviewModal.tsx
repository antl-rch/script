import './fgaPresentationPreviewModal.scss';
import { FaFilePdf, FaTimes } from 'react-icons/fa';
import { Button } from '../button/index.ts';
import type { CampaignScriptDocument, Prospect } from '../../../utils/types/index.ts';

interface FgaPresentationPreviewModalProps {
  isOpen: boolean;
  prospect: Prospect | null;
  document: CampaignScriptDocument | null;
  onSend: () => void;
  onCancel: () => void;
}

const buildGreeting = (prospect: Prospect | null): string => {
  const civilite = prospect?.civilite?.trim().toLocaleLowerCase('fr-FR').replace(/\./g, '');
  const label = civilite === 'm' || civilite === 'monsieur'
    ? 'Monsieur'
    : civilite === 'mme' || civilite === 'madame'
      ? 'Madame'
      : '';
  const recipient = [label, prospect?.nom?.trim()].filter(Boolean).join(' ');

  return recipient ? `Bonjour ${recipient},` : 'Bonjour,';
};

export default function FgaPresentationPreviewModal({
  isOpen,
  prospect,
  document,
  onSend,
  onCancel,
}: FgaPresentationPreviewModalProps) {
  if (!isOpen || !prospect) return null;

  const preview = document?.preview;
  return (
    <div className="fga-presentation-preview-modal__overlay" onClick={onCancel}>
      <section
        className="fga-presentation-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fga-presentation-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fga-presentation-preview-modal__header">
          <div>
            <p className="fga-presentation-preview-modal__eyebrow">Prévisualisation</p>
            <h2 id="fga-presentation-preview-title">{document?.label ?? 'Présentation FGA Consulting'}</h2>
          </div>
          <button
            type="button"
            className="fga-presentation-preview-modal__close"
            aria-label="Fermer la prévisualisation"
            onClick={onCancel}
          >
            <FaTimes />
          </button>
        </header>

        <div className="fga-presentation-preview-modal__meta">
          <p><span>À</span>{prospect.email}</p>
          <p><span>Objet</span>{preview?.subject ?? 'Suite à notre échange — sécuriser vos recrutements commerciaux · François Gournay'}</p>
        </div>

        <article className="fga-presentation-preview-modal__mail">
          {preview ? (
            <p className="fga-presentation-preview-modal__message">
              {preview.message.replace(/{{(salutation|fichier)}}/g, (_, variable: string) =>
                variable === 'salutation' ? buildGreeting(prospect) : preview.attachmentFilename)}
            </p>
          ) : (
            <>
              <p>{buildGreeting(prospect)}</p>
              <p>Comme convenu lors de notre échange téléphonique, je vous adresse ci-joint une courte présentation de mon accompagnement.</p>
              <p>En deux mots : recruteur indépendant et coach certifié, fort de <strong>25 ans d&apos;expérience dans le commercial et le management</strong>, j&apos;aide les start-up, scale-up et PME en forte croissance à <strong>sécuriser leurs recrutements clés</strong>, en plaçant des profils capables de tenir dans la durée et d&apos;éviter les départs précoces (6–12 mois) qui coûtent cher.</p>
              <p>Concrètement : un cadrage précis de vos enjeux, une évaluation structurée (dont l&apos;analyse <strong>MEDDIC</strong> pour les profils Sales), une shortlist argumentée, et un suivi d&apos;intégration sur 30 jours pour sécuriser la prise de poste.</p>
              <p>Vous trouverez le détail dans le document joint. La meilleure façon d&apos;avancer serait un <strong>échange de 30 à 45 minutes</strong> pour cadrer vos recrutements commerciaux prioritaires et voir concrètement comment les sécuriser.</p>
              <p>Quels créneaux vous conviendraient la semaine prochaine, par exemple <strong>mardi ou jeudi</strong> ? ( à ajuster selon votre trame)</p>
              <p>Bien à vous,</p>
              <p className="fga-presentation-preview-modal__signature"><strong>François Gournay</strong><br />Recruteur indépendant &amp; coach certifié<br />📞 06 65 58 71 11 · ✉️ <a href="mailto:francois.gournay@mercato-emploi.com">francois.gournay@mercato-emploi.com</a><br />🔗 <a href="https://linkedin.com/in/francoisgournay/" target="_blank" rel="noreferrer">linkedin.com/in/francoisgournay/</a></p>
              <p><em>P.J : One-Pager – François Gournay.pdf</em></p>
              <p><em>Je reste à ton écoute,</em></p>
            </>
          )}
        </article>

        <div className="fga-presentation-preview-modal__attachment">
          <FaFilePdf />
          <span>{preview?.attachmentFilename ?? 'One-Pager – François Gournay.pdf'}</span>
        </div>

        <footer className="fga-presentation-preview-modal__actions">
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button onClick={onSend}>Envoyer</Button>
        </footer>
      </section>
    </div>
  );
}
