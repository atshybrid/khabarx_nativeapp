
export interface Language {
  id: string;
  name: string;
  nativeName: string;
  code: string;
  color: string;
  isRtl: boolean;
}

export const LANGUAGES: Language[] = [
  { id: '1', name: 'English', nativeName: 'English', code: 'en', color: '#e74c3c', isRtl: false },
  { id: '2', name: 'Telugu', nativeName: 'తెలుగు', code: 'te', color: '#f1c40f', isRtl: false },
  { id: '3', name: 'Hindi', nativeName: 'हिन्दी', code: 'hi', color: '#3498db', isRtl: false },
  { id: '4', name: 'Tamil', nativeName: 'தமிழ்', code: 'ta', color: '#2ecc71', isRtl: false },
  { id: '5', name: 'Kannada', nativeName: 'ಕನ್ನಡ', code: 'kn', color: '#9b59b6', isRtl: false },
  { id: '6', name: 'Malayalam', nativeName: 'മലയാളം', code: 'ml', color: '#e67e22', isRtl: false },
  { id: '7', name: 'Marathi', nativeName: 'मराठी', code: 'mr', color: '#1abc9c', isRtl: false },
  { id: '8', name: 'Gujarati', nativeName: 'ગુજરાતી', code: 'gu', color: '#34495e', isRtl: false },
  { id: '9', name: 'Assamese', nativeName: 'অসমীয়া', code: 'as', color: '#27ae60', isRtl: false },
  { id: '10', name: 'Bengali', nativeName: 'বাংলা', code: 'bn', color: '#d35400', isRtl: false },
  { id: '11', name: 'Bodo', nativeName: 'बड़ो', code: 'brx', color: '#c0392b', isRtl: false },
  { id: '12', name: 'Dogri', nativeName: 'डोगरी', code: 'doi', color: '#8e44ad', isRtl: false },
  { id: '13', name: 'Kashmiri', nativeName: 'कश्मीरी', code: 'ks', color: '#2c3e50', isRtl: true },
  { id: '14', name: 'Konkani', nativeName: 'कोंकणी', code: 'kok', color: '#2980b9', isRtl: false },
  { id: '15', name: 'Maithili', nativeName: 'मैथिली', code: 'mai', color: '#f39c12', isRtl: false },
  { id: '16', name: 'Manipuri', nativeName: 'মৈতৈলোন্', code: 'mni', color: '#16a085', isRtl: false },
  { id: '17', name: 'Nepali', nativeName: 'नेपाली', code: 'ne', color: '#7f8c8d', isRtl: false },
  { id: '18', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', code: 'or', color: '#bdc3c7', isRtl: false },
  { id: '19', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', code: 'pa', color: '#2c3e50', isRtl: false },
  { id: '20', name: 'Sanskrit', nativeName: 'संस्कृतम्', code: 'sa', color: '#e74c3c', isRtl: false },
  { id: '21', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', code: 'sat', color: '#f1c40f', isRtl: false },
  { id: '22', name: 'Sindhi', nativeName: 'सिन्धी', code: 'sd', color: '#3498db', isRtl: true },
  { id: '23', name: 'Urdu', nativeName: 'اردو', code: 'ur', color: '#2ecc71', isRtl: true },
];
