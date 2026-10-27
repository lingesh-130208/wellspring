const library = [
  { title: 'How to do pelvic floor exercises | NHS', reason: 'An NHS physiotherapist explains pelvic-floor exercises. Watch only if the treating clinician confirms this education is suitable.', url: 'https://www.youtube.com/watch?v=JFJtUtKQCuM', videoId: 'JFJtUtKQCuM', source: 'NHS · verified educational video' },
  { title: 'Bladder health and pelvic-floor physiotherapy', reason: 'Find clinician-produced education related to bladder symptoms; the clinic should confirm which resource fits the report.', url: 'https://www.youtube.com/results?search_query=site%3Ayoutube.com+NHS+bladder+health+pelvic+floor+physiotherapy', source: 'NHS / physiotherapy educational search' },
  { title: 'Safe movement for older adults', reason: 'Gentle mobility education; only use movements cleared by the treating clinician.', url: 'https://www.youtube.com/results?search_query=NHS+safe+gentle+movement+older+adults', source: 'NHS educational video search' },
  { title: 'Pelvic health after surgery: clinician-led guidance', reason: 'For reports mentioning surgery; confirm suitability with the treating clinician first.', url: 'https://www.youtube.com/results?search_query=pelvic+floor+physiotherapist+after+surgery+guidance', source: 'Pelvic-health physiotherapy educational search' }
];

export function matchVideos(text) {
  const t = String(text || '').toLowerCase();
  const picks = [];
  if (/surgery|operation|post.?op|prolapse repair/.test(t)) picks.push(library[3]);
  if (/urinary|leakage|incontinence|bladder|urgency/.test(t)) picks.push(library[1], library[0]);
  if (/mobility|fall|balance|frail|older adult/.test(t)) picks.push(library[2]);
  return [...new Map(picks.map(p => [p.title, p])).values()].slice(0, 3);
}

export function localSummary(text) {
  const source = String(text || '');
  const mentioned = [];
  const terms = [
    [/urinary|leakage|incontinence|bladder|urgency/i, 'Urinary/bladder-related wording'],
    [/surgery|operation|post.?op/i, 'Surgery/post-operative wording'],
    [/pain|painful/i, 'Pain mentioned'],
    [/bleeding/i, 'Bleeding mentioned'],
    [/fall|balance|mobility/i, 'Mobility/balance wording'],
    [/diabetes|glucose/i, 'Diabetes/glucose mentioned'],
    [/ecg|cardiac|heart/i, 'Cardiac/ECG wording']
  ];
  for (const [pattern, label] of terms) if (pattern.test(source)) mentioned.push(label);
  return {
    summary: 'Local fallback only: no AI provider was called. Review the original report directly; this summary does not interpret clinical meaning.',
    mentioned,
    questionsForClinician: [
      'Confirm the symptoms, timeline, and functional impact from the original report.',
      'Check contraindications, recent procedures, pain, bleeding, and current clinician exercise clearance.',
      'Confirm which educational resources are suitable for this individual.'
    ],
    caution: 'No diagnosis, prescription, or exercise clearance was generated.'
  };
}
