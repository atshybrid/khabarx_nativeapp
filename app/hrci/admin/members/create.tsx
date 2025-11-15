import { Colors } from '@/constants/Colors';
import { createAdminMember } from '@/services/hrciAdmin';
import { getCountries, getDistricts, getMandals, getStates, HrcCountry, HrcDistrict, HrcMandal, HrcState } from '@/services/hrciGeo';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

export default function HrciAdminCreateMember() {
  const [step, setStep] = useState<number>(0);
  const [fullName, setFullName] = useState<string>('');
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [level, setLevel] = useState<string>('NATIONAL');
  const [cell, setCell] = useState<string>('');
  const [designationCode, setDesignationCode] = useState<string>('');
  const [zone, setZone] = useState<string>('');
  const [activate, setActivate] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  // Geo selections
  const [countries, setCountries] = useState<HrcCountry[]>([]);
  const [states, setStates] = useState<HrcState[]>([]);
  const [districts, setDistricts] = useState<HrcDistrict[]>([]);
  const [mandals, setMandals] = useState<HrcMandal[]>([]);
  const [countryId, setCountryId] = useState<string>('');
  const [stateId, setStateId] = useState<string>('');
  const [districtId, setDistrictId] = useState<string>('');
  const [mandalId, setMandalId] = useState<string>('');

  // Load countries initially
  useEffect(() => {
    (async () => {
      try {
        const c = await getCountries();
        setCountries(c);
        if (c.length && !countryId) setCountryId(c[0].id);
      } catch {}
    })();
  }, []);

  // Load states when country changes & needed for level
  useEffect(() => {
    if (!countryId) return;
    if (!['STATE','DISTRICT','MANDAL'].includes(level)) return;
    (async () => {
      try { setStates(await getStates(countryId)); } catch { setStates([]); }
    })();
  }, [countryId, level]);

  // Load districts when state changes & needed for level
  useEffect(() => {
    if (!stateId) return;
    if (!['DISTRICT','MANDAL'].includes(level)) return;
    (async () => {
      try { setDistricts(await getDistricts(stateId)); } catch { setDistricts([]); }
    })();
  }, [stateId, level]);

  // Load mandals when district changes & needed for level
  useEffect(() => {
    if (!districtId) return;
    if (!(level === 'MANDAL')) return;
    (async () => {
      try { setMandals(await getMandals(districtId)); } catch { setMandals([]); }
    })();
  }, [districtId, level]);

  const levelOptions = ['NATIONAL','ZONE','STATE','DISTRICT','MANDAL'];

  const mobileValid = useMemo(() => /^([6-9]\d{9})$/.test(mobileNumber.trim()), [mobileNumber]);
  const canNextBasic = fullName.trim().length >= 3 && mobileValid;
  const canSubmit = useMemo(() => {
    if (!canNextBasic) return false;
    if (!level) return false;
    if (['ZONE','STATE','DISTRICT','MANDAL'].includes(level) && !zone.trim()) return false;
    if (['STATE','DISTRICT','MANDAL'].includes(level) && !stateId) return false;
    if (['DISTRICT','MANDAL'].includes(level) && !districtId) return false;
    if (level === 'MANDAL' && !mandalId) return false;
    return true;
  }, [canNextBasic, level, zone, stateId, districtId, mandalId]);

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const payload: any = {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        level,
        activate,
      };
      if (cell.trim()) payload.cell = cell.trim();
      if (designationCode.trim()) payload.designationCode = designationCode.trim();
      if (zone.trim()) payload.zone = zone.trim();
      if (countryId) payload.hrcCountryId = countryId;
      if (['STATE','DISTRICT','MANDAL'].includes(level) && stateId) payload.hrcStateId = stateId;
      if (['DISTRICT','MANDAL'].includes(level) && districtId) payload.hrcDistrictId = districtId;
      if (level === 'MANDAL' && mandalId) payload.hrcMandalId = mandalId;
      const created = await createAdminMember(payload);
      Alert.alert('Member Created', created?.user?.profile?.fullName || 'Success');
      router.replace('/hrci/admin/members' as any);
    } catch (e: any) {
      Alert.alert('Create Member', e?.message || 'Failed to create member');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, fullName, mobileNumber, level, activate, cell, designationCode, zone, countryId, stateId, districtId, mandalId]);

  const StepIndicators = () => (
    <View style={styles.stepsRow}>
      {[0,1,2,3,4].map(i => (
        <View key={i} style={[styles.stepDot, i === step && styles.stepDotActive]} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="arrow-left" size={18} color={Colors.light.primary} />
        </Pressable>
        <Text style={styles.appTitle}>Create Member</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}> 
        <StepIndicators />
        {step === 0 && (
          <View style={styles.card}> 
            <Text style={styles.sectionTitle}>Basic Info</Text>
            <View style={styles.field}> 
              <Text style={styles.label}>Full Name</Text>
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor="#94a3b8" style={styles.input} />
            </View>
            <View style={styles.field}> 
              <Text style={styles.label}>Mobile Number</Text>
              <TextInput value={mobileNumber} onChangeText={setMobileNumber} placeholder="10-digit" placeholderTextColor="#94a3b8" style={styles.input} keyboardType="phone-pad" />
              {!mobileValid && mobileNumber.length > 0 && <Text style={styles.errorTxt}>Invalid mobile format</Text>}
            </View>
            <Pressable disabled={!canNextBasic} onPress={nextStep} style={({ pressed }) => [styles.primaryBtn, !canNextBasic && styles.btnDisabled, pressed && canNextBasic && { opacity: 0.9 }]}>
              <Text style={styles.primaryBtnText}>Next</Text>
            </Pressable>
          </View>
        )}
        {step === 1 && (
          <View style={styles.card}> 
            <Text style={styles.sectionTitle}>Select Level</Text>
            <View style={styles.chipsWrap}> 
              {levelOptions.map(l => {
                const sel = l === level; return (
                  <Pressable key={l} onPress={() => setLevel(l)} style={({ pressed }) => [styles.chip, sel && styles.chipSelected, pressed && { opacity: 0.9 }]}>
                    <Text style={[styles.chipTxt, sel && styles.chipTxtSelected]}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
            {['ZONE','STATE','DISTRICT','MANDAL'].includes(level) && (
              <View style={styles.field}> 
                <Text style={styles.label}>Zone</Text>
                <TextInput value={zone} onChangeText={setZone} placeholder="Zone name/code" placeholderTextColor="#94a3b8" style={styles.input} />
              </View>
            )}
            <View style={styles.rowBtns}> 
              <Pressable onPress={prevStep} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}><Text style={styles.ghostBtnTxt}>Back</Text></Pressable>
              <Pressable onPress={nextStep} style={({ pressed }) => [styles.primaryBtnSmall, pressed && { opacity: 0.9 }]}><Text style={styles.primaryBtnTextSmall}>Next</Text></Pressable>
            </View>
          </View>
        )}
        {step === 2 && (
          <View style={styles.card}> 
            <Text style={styles.sectionTitle}>Cell & Designation</Text>
            <View style={styles.field}> 
              <Text style={styles.label}>Cell Code</Text>
              <TextInput value={cell} onChangeText={setCell} placeholder="Cell code" placeholderTextColor="#94a3b8" style={styles.input} />
            </View>
            <View style={styles.field}> 
              <Text style={styles.label}>Designation Code</Text>
              <TextInput value={designationCode} onChangeText={setDesignationCode} placeholder="Designation code" placeholderTextColor="#94a3b8" style={styles.input} />
            </View>
            <View style={styles.rowBtns}> 
              <Pressable onPress={prevStep} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}><Text style={styles.ghostBtnTxt}>Back</Text></Pressable>
              <Pressable onPress={nextStep} style={({ pressed }) => [styles.primaryBtnSmall, pressed && { opacity: 0.9 }]}><Text style={styles.primaryBtnTextSmall}>Next</Text></Pressable>
            </View>
          </View>
        )}
        {step === 3 && (
          <View style={styles.card}> 
            <Text style={styles.sectionTitle}>Location Details</Text>
            <Text style={styles.hintTxt}>Provide geo hierarchy required for selected level.</Text>
            {/* Country (always available for state/district/mandal) */}
            {['STATE','DISTRICT','MANDAL'].includes(level) && (
              <View style={styles.field}> 
                <Text style={styles.label}>Country</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}> 
                  {countries.map(c => {
                    const sel = c.id === countryId; return (
                      <Pressable key={c.id} onPress={() => { setCountryId(c.id); setStateId(''); setDistrictId(''); setMandalId(''); }} style={({ pressed }) => [styles.chipSm, sel && styles.chipSelected, pressed && { opacity: 0.9 }]}>
                        <Text style={[styles.chipTxtSm, sel && styles.chipTxtSelected]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {['STATE','DISTRICT','MANDAL'].includes(level) && states.length > 0 && (
              <View style={styles.field}> 
                <Text style={styles.label}>State</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}> 
                  {states.map(s => {
                    const sel = s.id === stateId; return (
                      <Pressable key={s.id} onPress={() => { setStateId(s.id); setDistrictId(''); setMandalId(''); }} style={({ pressed }) => [styles.chipSm, sel && styles.chipSelected, pressed && { opacity: 0.9 }]}>
                        <Text style={[styles.chipTxtSm, sel && styles.chipTxtSelected]}>{s.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {['DISTRICT','MANDAL'].includes(level) && districts.length > 0 && (
              <View style={styles.field}> 
                <Text style={styles.label}>District</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}> 
                  {districts.map(d => {
                    const sel = d.id === districtId; return (
                      <Pressable key={d.id} onPress={() => { setDistrictId(d.id); setMandalId(''); }} style={({ pressed }) => [styles.chipSm, sel && styles.chipSelected, pressed && { opacity: 0.9 }]}>
                        <Text style={[styles.chipTxtSm, sel && styles.chipTxtSelected]}>{d.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {level === 'MANDAL' && mandals.length > 0 && (
              <View style={styles.field}> 
                <Text style={styles.label}>Mandal</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}> 
                  {mandals.map(m => {
                    const sel = m.id === mandalId; return (
                      <Pressable key={m.id} onPress={() => setMandalId(m.id)} style={({ pressed }) => [styles.chipSm, sel && styles.chipSelected, pressed && { opacity: 0.9 }]}>
                        <Text style={[styles.chipTxtSm, sel && styles.chipTxtSelected]}>{m.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            <View style={styles.rowBtns}> 
              <Pressable onPress={prevStep} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}><Text style={styles.ghostBtnTxt}>Back</Text></Pressable>
              <Pressable onPress={nextStep} style={({ pressed }) => [styles.primaryBtnSmall, pressed && { opacity: 0.9 }]}><Text style={styles.primaryBtnTextSmall}>Next</Text></Pressable>
            </View>
          </View>
        )}
        {step === 4 && (
          <View style={styles.card}> 
            <Text style={styles.sectionTitle}>Review & Submit</Text>
            <View style={styles.reviewRow}><Text style={styles.revKey}>Name</Text><Text style={styles.revVal}>{fullName || '—'}</Text></View>
            <View style={styles.reviewRow}><Text style={styles.revKey}>Mobile</Text><Text style={styles.revVal}>{mobileNumber || '—'}</Text></View>
            <View style={styles.reviewRow}><Text style={styles.revKey}>Level</Text><Text style={styles.revVal}>{level}</Text></View>
            {cell ? <View style={styles.reviewRow}><Text style={styles.revKey}>Cell</Text><Text style={styles.revVal}>{cell}</Text></View> : null}
            {designationCode ? <View style={styles.reviewRow}><Text style={styles.revKey}>Designation</Text><Text style={styles.revVal}>{designationCode}</Text></View> : null}
            {zone ? <View style={styles.reviewRow}><Text style={styles.revKey}>Zone</Text><Text style={styles.revVal}>{zone}</Text></View> : null}
            {stateId ? <View style={styles.reviewRow}><Text style={styles.revKey}>StateId</Text><Text style={styles.revVal}>{stateId}</Text></View> : null}
            {districtId ? <View style={styles.reviewRow}><Text style={styles.revKey}>DistrictId</Text><Text style={styles.revVal}>{districtId}</Text></View> : null}
            {mandalId ? <View style={styles.reviewRow}><Text style={styles.revKey}>MandalId</Text><Text style={styles.revVal}>{mandalId}</Text></View> : null}
            <View style={[styles.reviewRow,{ justifyContent:'space-between' }]}> 
              <Text style={styles.revKey}>Activate Now</Text>
              <Switch value={activate} onValueChange={setActivate} />
            </View>
            <View style={styles.rowBtns}> 
              <Pressable onPress={prevStep} style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}><Text style={styles.ghostBtnTxt}>Back</Text></Pressable>
              <Pressable disabled={!canSubmit || loading} onPress={handleSubmit} style={({ pressed }) => [styles.primaryBtn, (!canSubmit || loading) && styles.btnDisabled, pressed && canSubmit && !loading && { opacity: 0.9 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Member</Text>}
              </Pressable>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor:'#fff' },
  appTitle: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7' },
  content: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef2f7', marginBottom: 12 },
  sectionTitle: { color: '#0f172a', fontWeight: '900', fontSize: 14, marginBottom: 10 },
  field: { marginBottom: 12 },
  label: { color: '#64748b', fontWeight: '800', marginBottom: 4 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, backgroundColor: '#f8fafc', color: '#0f172a', fontWeight:'700' },
  primaryBtn: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', flex:1 },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  primaryBtnSmall: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal:16, alignItems: 'center' },
  primaryBtnTextSmall: { color: '#fff', fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },
  ghostBtn: { borderWidth:1, borderColor:'#e5e7eb', backgroundColor:'#fff', borderRadius:10, paddingVertical:10, paddingHorizontal:16 },
  ghostBtnTxt: { color:'#0f172a', fontWeight:'800' },
  chipsWrap: { flexDirection:'row', flexWrap:'wrap', gap:8 },
  chip: { paddingVertical:8, paddingHorizontal:14, borderRadius:20, backgroundColor:'#f1f5f9', borderWidth:1, borderColor:'#e2e8f0' },
  chipSelected: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipTxt: { color:'#0f172a', fontWeight:'800' },
  chipTxtSelected: { color:'#fff' },
  rowBtns: { flexDirection:'row', alignItems:'center', gap:12, marginTop:4 },
  errorTxt: { color:'#dc2626', fontSize:12, marginTop:4, fontWeight:'700' },
  hintTxt: { color:'#64748b', fontSize:12, marginBottom:8 },
  stepsRow: { flexDirection:'row', gap:6, marginBottom:12, justifyContent:'center' },
  stepDot: { width:10, height:10, borderRadius:5, backgroundColor:'#e2e8f0' },
  stepDotActive: { backgroundColor: Colors.light.primary },
  chipsRow: { gap:8, paddingVertical:6 },
  chipSm: { paddingVertical:6, paddingHorizontal:12, borderRadius:16, backgroundColor:'#f1f5f9', borderWidth:1, borderColor:'#e2e8f0' },
  chipTxtSm: { color:'#0f172a', fontWeight:'700', fontSize:12 },
  reviewRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6 },
  revKey: { color:'#64748b', fontWeight:'800' },
  revVal: { color:'#0f172a', fontWeight:'900', maxWidth:'60%' },
});
