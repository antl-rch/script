import { apiCalls } from '../APICalls';
import { throwIfApiError, extractPaginatedData } from '../apiHelpers';
import { CampaignModel, supportToPlan, supportToObjections } from '../models';
import type { Campaign, PlanAppelEtape, Objection, CampaignPanier, ScriptSupport, ScriptSupportKind } from '../../utils/types';
import { buildQueryString } from '../../utils/scripts/utils';

export class CampaignService {
  private static instance: CampaignService;

  private constructor() {}

  public static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  public async getCampaignById(id: number): Promise<CampaignModel> {
    const response = await apiCalls.get<Campaign>(`/campagnes/${id}?script_documents_version=2`);
    const data = throwIfApiError(response, 'Erreur lors de la récupération de la campagne');
    return CampaignModel.fromJSON(data);
  }

  public async getCampaigns(params?: {
    page?: number;
    limit?: number;
    actif?: boolean;
  }): Promise<{ campaigns: CampaignModel[]; total: number; page: number; totalPages: number }> {
    const queryString = buildQueryString(params);
    const response = await apiCalls.get<Campaign[]>(`/campagnes${queryString}`);

    const result = extractPaginatedData(response, CampaignModel.fromJSON, 'Erreur lors de la récupération des campagnes');
    return {
      campaigns: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  public async getScriptSupport(campagneId: number, kind: ScriptSupportKind): Promise<ScriptSupport> {
    const response = await apiCalls.get<ScriptSupport>(`/campagnes/${campagneId}/supports/${kind}`);
    return throwIfApiError(response, 'Erreur lors de la récupération du support');
  }

  public async getPlanAppel(campagneId: number): Promise<PlanAppelEtape[]> {
    return supportToPlan(await this.getScriptSupport(campagneId, 'plan-appel'), campagneId);
  }

  public async getObjections(campagneId: number): Promise<Objection[]> {
    return supportToObjections(await this.getScriptSupport(campagneId, 'objections'), campagneId);
  }

  public async getPaniers(campagneId: number): Promise<CampaignPanier[]> {
    const response = await apiCalls.get<CampaignPanier[]>(`/campagnes/${campagneId}/paniers`);
    return throwIfApiError(response, 'Erreur lors de la recuperation des paniers');
  }
}

export const campaignService = CampaignService.getInstance();
