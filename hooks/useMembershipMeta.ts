import { CellMeta, CountryMeta, DesignationMeta, DistrictMeta, fetchCells, fetchCountries, fetchDesignations, fetchDistricts, fetchLevels, fetchLocations, fetchMandals, fetchStates, LevelMeta, LocationMeta, MandalMeta, StateMeta } from '@/services/membershipMeta';
import { useCallback, useEffect, useState } from 'react';

interface UseMembershipMetaOptions {
  autoLoad?: boolean;
}

interface UseMembershipMetaResult {
  levels: LevelMeta[];
  cells: CellMeta[];
  designations: DesignationMeta[];
  locations: LocationMeta[];
  countries: CountryMeta[];
  states: StateMeta[];
  districts: DistrictMeta[];
  mandals: MandalMeta[];
  loading: boolean;
  error: string | null;
  selected: { level?: string; cellId?: string; designationId?: string; locationId?: string; countryId?: string; stateId?: string; districtId?: string; mandalId?: string };
  selectLevel: (level: string | undefined) => void;
  selectCell: (id: string | undefined) => void;
  selectDesignation: (id: string | undefined) => void;
  selectLocation: (id: string | undefined) => void;
  selectCountry: (id: string | undefined) => void;
  selectState: (id: string | undefined) => void;
  selectDistrict: (id: string | undefined) => void;
  selectMandal: (id: string | undefined) => void;
  reload: () => void;
}

export function useMembershipMeta(options: UseMembershipMetaOptions = {}): UseMembershipMetaResult {
  const { autoLoad = true } = options;
  const [levels, setLevels] = useState<LevelMeta[]>([]);
  const [cells, setCells] = useState<CellMeta[]>([]);
  const [designations, setDesignations] = useState<DesignationMeta[]>([]);
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const [selected, setSelected] = useState<{ level?: string; cellId?: string; designationId?: string; locationId?: string; countryId?: string; stateId?: string; districtId?: string; mandalId?: string }>({});
  const [countries, setCountries] = useState<CountryMeta[]>([]);
  const [states, setStates] = useState<StateMeta[]>([]);
  const [districts, setDistricts] = useState<DistrictMeta[]>([]);
  const [mandals, setMandals] = useState<MandalMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const lv = await fetchLevels();
      setLevels(lv);
      const lvlCode = selected.level; // we treat id as level code
      const [cellList, designationList, locationList] = await Promise.all([
        fetchCells(lvlCode),
        fetchDesignations(lvlCode),
        fetchLocations(lvlCode),
      ]);
      setCells(cellList);
      setDesignations(designationList);
      setLocations(locationList);
      const countryList = await fetchCountries();
      setCountries(countryList);
      const [stateList, districtList, mandalList] = await Promise.all([
        fetchStates(selected.countryId),
        fetchDistricts(selected.stateId),
        fetchMandals(selected.districtId),
      ]);
      setStates(stateList);
      setDistricts(districtList);
      setMandals(mandalList);
    } catch (e: any) {
      setError(e?.message || 'Failed loading meta');
    } finally {
      setLoading(false);
    }
  }, [selected.level, selected.countryId, selected.stateId, selected.districtId]);

  useEffect(() => { if (autoLoad) load(); }, [autoLoad, load]);

  // When level changes, clear downstream selections for consistency
  const selectLevel = (level: string | undefined) => {
    setSelected(prev => ({ ...prev, level, cellId: undefined, designationId: undefined, locationId: undefined }));
  };
  const selectCell = (id: string | undefined) => { setSelected(prev => ({ ...prev, cellId: id })); };
  const selectDesignation = (id: string | undefined) => { setSelected(prev => ({ ...prev, designationId: id })); };
  const selectLocation = (id: string | undefined) => { setSelected(prev => ({ ...prev, locationId: id })); };
  const selectCountry = (id: string | undefined) => { setSelected(prev => ({ ...prev, countryId: id, stateId: undefined, districtId: undefined, mandalId: undefined })); };
  const selectState = (id: string | undefined) => { setSelected(prev => ({ ...prev, stateId: id, districtId: undefined, mandalId: undefined })); };
  const selectDistrict = (id: string | undefined) => { setSelected(prev => ({ ...prev, districtId: id, mandalId: undefined })); };
  const selectMandal = (id: string | undefined) => { setSelected(prev => ({ ...prev, mandalId: id })); };

  return { levels, cells, designations, locations, countries, states, districts, mandals, loading, error, selected, selectLevel, selectCell, selectDesignation, selectLocation, selectCountry, selectState, selectDistrict, selectMandal, reload: load };
}
export default useMembershipMeta;
