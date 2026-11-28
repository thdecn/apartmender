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
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \clef treble
  \key es \major
  \time 12/8
  \mark \markup { \box \bold "m. 9" }
  f''4.-4\p \dif g''4-5\> (f''8)\! f''4.\pp (c''4.)
  \pri es''8-.-4\startTextSpan (
  \bar "|."
}

lowerCard = {
  \clef bass
  \key es \major
  \time 12/8
  bes,8_\finger "(3)"-.\ped <f d'> (<bes d' f'>) bes,-. <f d'> (<bes d' f'>)\pes a,-.\ped <f c'> (<c' f'>) a,-. <f c'> (<c' f'>)\pes
  as,!8_\finger "(3)"-.\ped
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
