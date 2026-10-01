import { WaterApplicationStatus, LandHolding } from '../src/types/domain';

describe('Water Application Eligibility and Active vs Historical Rules', () => {
  const holdings: LandHolding[] = [
    {
      holding_id: 'hld-01',
      beneficiary_id: 'ben-01',
      project_id: 'prj-csii',
      declared_total_area: 5.0,
      area_unit: 'acres',
      status: 'ACTIVE',
      is_locked: true,
      has_active_allotment: true,
      parcels: [],
      sync_status: 'SYNCED',
      local_version: 1,
      server_version: 1,
      created_at: '',
      updated_at: '',
    },
    {
      holding_id: 'hld-02',
      beneficiary_id: 'ben-01',
      project_id: 'prj-csii',
      declared_total_area: 3.0,
      area_unit: 'acres',
      status: 'ACTIVE',
      is_locked: false,
      has_active_allotment: false,
      parcels: [],
      sync_status: 'SYNCED',
      local_version: 1,
      server_version: 1,
      created_at: '',
      updated_at: '',
    },
    {
      holding_id: 'hld-03',
      beneficiary_id: 'ben-01',
      project_id: 'prj-csii',
      declared_total_area: 4.0,
      area_unit: 'acres',
      status: 'ARCHIVED',
      is_locked: false,
      has_active_allotment: false,
      parcels: [],
      sync_status: 'SYNCED',
      local_version: 1,
      server_version: 1,
      created_at: '',
      updated_at: '',
    },
  ];

  it('should filter out holdings with active allotments from new water application selection', () => {
    const eligibleHoldings = holdings.filter(
      (h) => !h.has_active_allotment && h.status === 'ACTIVE'
    );
    expect(eligibleHoldings).toHaveLength(1);
    expect(eligibleHoldings[0].holding_id).toBe('hld-02');
  });

  it('should correctly classify application statuses into Active vs Historical', () => {
    const activeStatuses: WaterApplicationStatus[] = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];
    const historicalStatuses: WaterApplicationStatus[] = ['REJECTED', 'CANCELLED', 'VOIDED'];

    const testApplications = [
      { id: '1', status: 'SUBMITTED' as WaterApplicationStatus },
      { id: '2', status: 'APPROVED' as WaterApplicationStatus },
      { id: '3', status: 'CANCELLED' as WaterApplicationStatus },
      { id: '4', status: 'REJECTED' as WaterApplicationStatus },
    ];

    const activeList = testApplications.filter((app) => !historicalStatuses.includes(app.status));
    const historyList = testApplications.filter((app) => historicalStatuses.includes(app.status));

    expect(activeList.map((a) => a.id)).toEqual(['1', '2']);
    expect(historyList.map((a) => a.id)).toEqual(['3', '4']);
  });
});
