\version "2.26.0"
#(set-global-staff-size 25)
\language "nederlands"
%%%Il gruppetto cromatico%%%
grc = ^\markup{\column {\center-align { \lower #6.5 {\finger"12121"} \tiny \lower #4.5 { \flat} \lower #3.0 \musicglyph "scripts.turn" \tiny { \natural}}}}


%%%Posizione testo e dinamiche%%%
 chopinDynamicSpacing = \override DynamicLineSpanner.staff-padding = #3.5 
 ddd = \once \override DynamicLineSpanner.staff-padding = #0
 ttt = \once \override TextScript.staff-padding = #0 
 dpp = \once \override DynamicLineSpanner.staff-padding = #1.6
 
%%%Diteggiatura dentro la legatura %%%
 did = \override Fingering.avoid-slur = #'inside 
 
%%%Diteggiatura fuori dalla legatura (Default)%%%
 dif = \override Fingering.avoid-slur = #'outside
 
%%%Simboli dentro la legatura%%%
 sot = \override Script.avoid-slur = #'inside
 
%%%Pedale giù Markup%%%
ped = _\markup \small {\hspace #-1.0 \musicglyph  "pedal.Ped" \hspace #-1.0 "."} 

%%%Pedale su Markup%%%
pes = _\markup \small {\hspace #-1.0 \musicglyph "pedal.*"}

%%%Diteggiatura supplementare Markup%%%
uno = \markup { \finger "1" }
due = \markup { \finger "2" }
tre = \markup { \finger "3" }
qua = \markup { \finger "4" }
cin = \markup { \finger "5" }

%%%Vari.%%%
pri = \override TextSpanner.bound-details.left.text = "poco ritard. "
pra = \mark \markup {\italic \normalsize "poco rallent."}
prl = ^\markup {\italic \normalsize "poco rall."}
pru = _\markup {\italic \normalsize "poco rubato"}
spp = _\markup {\italic \normalsize "sempre  " \dynamic pp}
dol = _\markup {\italic \normalsize "dolcissimo"}
tei = ^\markup{\bold \normalsize "Tempo I."}

%%%f tra parentesi%%%
fpa = \markup{ \center-align {\line  { \bold{\fontsize #3 \italic  (}
       \hspace # -1.0 \raise # 0.5 \dynamic f \bold{\hspace # -1.0 \fontsize #3 \italic  )} }} }	   
	   
%%%più P tra parentesi%%%
ppt = \markup{ \center-align {\line  { \italic ( \italic più  \dynamic p
         \italic  ) }} }	   


\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 520\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \clef treble
  \key es \major
  \time 12/8
  \ottava #1
  \mark \markup { \box \bold "m. 32" }
  \cadenzaOn <ces''' ces''''>2.^\finger "(15)"-^_\markup {\dynamic ff \italic 
\normalsize "senza        –          –        tempo" } s4 <bes'' bes'''>2.-^\fermata \tiny{ \ddd \stemUp \override DynamicLineSpanner.staff-padding = #2.0 ces''''!16-3\< [bes'''-2 c''''!-4 a'''!-1]  ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a''']    ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a''']   ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a'''] ces''''_\markup  {  \italic 
\normalsize "cresc." } [bes''' c''''! a'''\!] \bar "" ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a'''] \ddd ces''''\>_\markup {  \italic 
\normalsize "dimin." } [bes''' c''''! a'''\!]  ces'''' [bes''' c''''! a''']  ces''''  [bes''' d''''-5 c''''!-4] bes'''-2_\markup { \italic 
\normalsize "rallent. smorz." } [a'''-1 as'''-4 g'''-3] f'''-2 [d'''-1 (es'''-2 ces'''-1]
\ottava #0
bes''8-4 [ as'' c'' d''-3)]} \cadenzaOff  \normalsize
  \stemNeutral  \once \override TextScript.extra-offset = #'( 0.0 . -2.0 ) <g' es''-4>8^\finger "(1)"_\markup{\dynamic pp} (\once \override TextScript.extra-offset = #'( -3.0 . 0.0 )
  \bar "|."
}

lowerCard = {
  \clef bass
  \key es \major
  \time 12/8
  \cadenzaOn \once \override PhrasingSlur.positions = #'(3 . 5) \stemDown bes,,8_\tweak extra-offset #'(2.5 . 0) \finger "(3)"\ped [ \(\once \override TextScript.extra-offset = #'( -0.4 . -5.5 ) bes,^\markup { \finger "15" } \did \once \override TextScript.extra-offset = #'( 0.0 . -4.0 ) f^\tre \dif as!-2   d'-1 \did bes-5
       \clef treble
\once \override TextScript.extra-offset = #'( 0.0 . -6.0 ) f'^\tre \once \override TextScript.extra-offset = #'( 0.0 . -5.0 ) as']^\due\)  d''2.-1\fermata
       \clef bass
s1  s s s s8 s\pes  \cadenzaOff 
  << { \oneVoice \stemUp 
s8 } \\ { \voiceTwo  \stemDown \slurUp \once \override Slur.extra-offset = #'(0.0 . 2.5) \once \override Slur.positions = #'(-1.0 . -1.0) es,8_\finger "(5)"^.\ped } >>
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
