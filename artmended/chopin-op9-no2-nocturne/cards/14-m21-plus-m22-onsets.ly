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
  \mark \markup { \box \bold "m. 21" }
  \grace { \key es \major  \once \override DynamicLineSpanner.staff-padding = #3.3 g'16^\finger "(1)"\sf\tei [(bes' es'']} g''4) \p a'16 (bes' ces''-> bes' \accidentalStyle forget cis'' \accidentalStyle default d''-1 \dif g''16.->-4 f''32) \ddd f''4\> ( es''8->-2\!)~ es''16 f'' (es''\trill \ddd d''\< es'' f''\!
  g''16^\finger "(5)") s1*1/16
  \bar "|."
}

lowerCard = {
  \grace { \key es \major s1*3/16 }
  es,8_\finger "(3)"-.\ped <g es'> (<bes es' g'>)\pes es-. <as d'> (<bes d' as'>) es-. <g es'> (<bes es' g'>) d-. <g es'> (<bes es' g'>)
  c8_\finger "(5)"-.
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \with { clefGlyph = "clefs.G" clefPosition = #-2 middleCClefPosition = #-6 middleCPosition = #-6 timeSignature = #'(12 . 8) keyAlterations = #'((2 . -1/2) (3 . 0) (4 . 0) (5 . -1/2) (6 . -1/2) (0 . 0) (1 . 0)) } \upperCard
    \new Staff = "lower" \with { clefGlyph = "clefs.F" clefPosition = #2 middleCClefPosition = #6 middleCPosition = #6 timeSignature = #'(12 . 8) keyAlterations = #'((2 . -1/2) (3 . 0) (4 . 0) (5 . -1/2) (6 . -1/2) (0 . 0) (1 . 0)) } \lowerCard
  >>
  \layout {
    \context { \Score measureLength = #3/2 timeSignature = #'(12 . 8) }
    ragged-right = ##f
    system-count = 1
  }
}
