// Viewer fixture only: actual 3:2 MusicXML, not inferred triplets or a known piece.
export function viewerScore(measureCount = 64) {
  const note = (id, step, octave, duration, type, extra = '', notations = '') =>
    `<note id="${id}">${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>1</voice><type>${type}</type><staff>1</staff>${notations}</note>`;
  const measures = [];
  for (let m = 1; m <= measureCount; m++) {
    const first = m === 1 ? '<attributes><divisions>12</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>' : '';
    const head = note(`vp-m${m}-head`, 'G', 4, 12, 'quarter', '', m > 1 ? '<notations><tied type="stop"/></notations>' : '')
      .replace('<voice>', `${m > 1 ? '<tie type="stop"/>' : ''}<voice>`);
    const chord = note(`vp-m${m}-chord`, 'E', 5, 12, 'quarter', '<chord/>');
    const triplet = ['D', 'E', 'F'].map((step, index) => note(`vp-m${m}-triplet${index}`, step, 4, 4, 'eighth', '',
      `<beam number="1">${['begin', 'continue', 'end'][index]}</beam>${index !== 1 ? `<notations><tuplet type="${index ? 'stop' : 'start'}" number="1" bracket="yes"/></notations>` : ''}`)
      .replace('<staff>', '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>eighth</normal-type></time-modification><staff>')).join('');
    const end = note(`vp-m${m}-tie`, 'G', 4, 12, 'quarter', '', m < measureCount ? '<notations><tied type="start"/></notations>' : '')
      .replace('<voice>', `${m < measureCount ? '<tie type="start"/>' : ''}<voice>`);
    const bass = '<backup><duration>48</duration></backup><note><pitch><step>C</step><octave>3</octave></pitch><duration>24</duration><voice>2</voice><type>half</type><staff>2</staff></note><note><pitch><step>E</step><octave>3</octave></pitch><duration>12</duration><voice>2</voice><type>quarter</type><staff>2</staff></note><note><rest/><duration>12</duration><voice>2</voice><type>quarter</type><staff>2</staff></note>';
    measures.push(`<measure number="${m}" id="viewer-m${m}">${first}${head}${chord}${triplet}<note><rest/><duration>12</duration><voice>1</voice><type>quarter</type><staff>1</staff></note>${end}${bass}</measure>`);
  }
  return `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
}
