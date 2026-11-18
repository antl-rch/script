import { apiCalls } from '../APICalls.ts';
import { throwIfApiError, extractPaginatedData } from '../apiHelpers.ts';
import { ProspectModel } from '../models/index.ts';
import type { Prospect, UpdateProspectData } from '../../utils/types/index.ts';
import { buildQueryString } from '../../utils/scripts/index.ts';
import { buildProspectOptoutPayload } from './prospectPayloads.ts';

export interface ProspectDocumentDispatch {
  recipientEmail: string;
  sentAt: string;
  simulated?: boolean;
}

export class ProspectService {
  private static instance: ProspectService;

  private constructor() {}

  public static getInstance(): ProspectService {
    if (!ProspectService.instance) {
      ProspectService.instance = new ProspectService();
    }
    return ProspectService.instance;
  }

  public async getProspectById(id: number, campagneId?: number | null): Promise<ProspectModel> {
    const query = campagneId ? `?campagne=${campagneId}` : '';
    const response = await apiCalls.get<Prospect>(`/prospects/${id}${query}`);
    const data = throwIfApiError(response, 'Erreur lors de la récupération du prospect');
    return ProspectModel.fromJSON(data);
  }

  public async getProspectByPhone(phone: string, campagneId?: number | null): Promise<ProspectModel> {
    const query = campagneId ? `?campagne=${campagneId}` : '';
    const response = await apiCalls.get<Prospect>(`/prospects/telephone/${encodeURIComponent(phone)}${query}`);
    const data = throwIfApiError(response, 'Prospect non trouvé');
    return ProspectModel.fromJSON(data);
  }

  public async getProspects(params?: {
    page?: number;
    limit?: number;
    statut?: string;
    type_prospect?: string;
    search?: string;
  }): Promise<{ prospects: ProspectModel[]; total: number; page: number; totalPages: number }> {
    const queryString = buildQueryString(params);
    const response = await apiCalls.get<Prospect[]>(`/prospects${queryString}`);

    const result = extractPaginatedData(response, ProspectModel.fromJSON, 'Erreur lors de la récupération des prospects');
    return {
      prospects: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  public async sendCatalogue(id: number): Promise<ProspectDocumentDispatch> {
    const response = await apiCalls.post<ProspectDocumentDispatch>(`/prospects/${id}/send-catalogue`, undefined, {
      timeout: 90000,
    });
    return throwIfApiError(response, 'Erreur lors de l\'envoi du catalogue');
  }

  public async sendPlaquette(id: number, idCampagne: number, documentType: 'plaquette' | 'coffret_douceur_gourmand' = 'plaquette'): Promise<ProspectDocumentDispatch> {
    const response = await apiCalls.post<ProspectDocumentDispatch>(`/prospects/${id}/send-plaquette`, { id_campagne: idCampagne, document_type: documentType }, {
      timeout: 90000,
    });
    return throwIfApiError(response, 'Erreur lors de l\'envoi de la plaquette');
  }

  public async sendCampaignDocument(campaignId: number, documentId: string,
    input: { prospectId: number; revision: number; recipientEmail: string }): Promise<ProspectDocumentDispatch> {
    const response = await apiCalls.post<ProspectDocumentDispatch>(
      `/campagnes/${campaignId}/documents-script/${encodeURIComponent(documentId)}/envoyer`,
      input, { timeout: 90000 },
    );
    return throwIfApiError(response, 'Erreur lors de l’envoi du document');
  }

  public async sendFgaPresentation(id: number): Promise<ProspectDocumentDispatch> {
    const response = await apiCalls.post<ProspectDocumentDispatch>(`/prospects/${id}/send-fga-presentation`, undefined, {
      timeout: 90000,
    });
    return throwIfApiError(response, 'Erreur lors de l\'envoi de la présentation FGA');
  }

  public async updateProspect(id: number, data: UpdateProspectData): Promise<ProspectModel> {
    const response = await apiCalls.put<Prospect>(`/prospects/${id}`, data);
    const updatedProspect = throwIfApiError(response, 'Erreur lors de la mise a jour du prospect');
    return ProspectModel.fromJSON(updatedProspect);
  }

  public async markDoublon(id: number): Promise<void> {
    const response = await apiCalls.patch(`/prospects/${id}/doublon`, {});
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors du signalement doublon');
    }
  }

  public async markOptout(id: number, campagneId: number): Promise<void> {
    const response = await apiCalls.patch(`/prospects/${id}/optout`, buildProspectOptoutPayload(campagneId));
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors de l\'enregistrement opt-out');
    }
  }
}

export const prospectService = ProspectService.getInstance();
