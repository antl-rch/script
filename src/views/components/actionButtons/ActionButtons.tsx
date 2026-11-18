import './actionButtons.scss';
import { FaCalendarAlt, FaCreditCard, FaFilePdf, FaPhone, FaShoppingCart, FaTag } from 'react-icons/fa';
import type { ReactNode } from 'react';
import type { ViewType } from '../../../utils/types/index.ts';
import type { ActionButtonId, CampaignActionConfig } from '../../../utils/scripts/index.ts';
import { Button } from '../button/index.ts';

interface ActionButtonsProps {
  currentView: ViewType;
  buttons: CampaignActionConfig[];
  onAction: (actionId: ActionButtonId) => void;
}

const ICONS: Partial<Record<ActionButtonId, ReactNode>> = {
  plaquette: <FaFilePdf />,
  'coffret-douceur-gourmand': <FaFilePdf />,
  'fga-presentation': <FaFilePdf />,
  tarifs: <FaTag />,
  'historique-appels': <FaPhone />,
  'historique-offres': <FaShoppingCart />,
  'rendez-vous': <FaCalendarAlt />,
  commande: <FaCreditCard />,
};

function renderButton(
  currentView: ViewType,
  button: CampaignActionConfig,
  onAction: (actionId: ActionButtonId) => void,
) {
  const isActive = button.targetView === currentView;

  return (
    <Button
      key={button.id}
      variant="primary"
      size="small"
      onClick={() => onAction(button.id)}
      disabled={isActive}
      className={isActive ? 'btn-active' : ''}
      type="button"
    >
      {ICONS[button.id] ?? <FaFilePdf />} {button.label}
    </Button>
  );
}

export default function ActionButtons({ currentView, buttons, onAction }: ActionButtonsProps) {
  const leftButtons = buttons.filter((button) => button.group === 'left');
  const rightButtons = buttons.filter((button) => button.group === 'right');

  return (
    <div className="action-buttons">
      <div className="action-buttons__group action-buttons__group--left">
        {leftButtons.map((button) => renderButton(currentView, button, onAction))}
      </div>
      <div className="action-buttons__group action-buttons__group--right">
        {rightButtons.map((button) => renderButton(currentView, button, onAction))}
      </div>
    </div>
  );
}
