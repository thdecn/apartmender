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
  \mark \markup { \box \bold "m. 24" }
  \ddd 
\once \override TextScript.extra-offset = #'( 1.5 . 0.5 )
\did bes'16-1-._\fpa\< ([ \dif d'''8-5 \set stemLeftBeamCount = #1 \set stemRightBeamCount = #2  
 cis'''16-.-4  \set stemLeftBeamCount = #2 c'''16-.-5 b''32-.-4] bes''16-.-3 [a''-.-5]) as''32-!-4 \did \once \override Slur.control-points = #'((0.5780665769885971 . 1.538888888888889) (2.599080601478846 . 3.554836415017885) (15.171548463022596 . 5.750497018210478) (17.75622404348792 . 4.538888888888889)) a'-1 ( bes'-2 b'-1 c'' cis'' d''-1  \tuplet 3/2  {\tupletUp \once \override TupletNumber.extra-offset = #'( 0.0 . 1.5 ) \once \override TupletBracket.extra-offset = #'( 0.0 . 1.5 ) g''-4  f''-3 es''-2\!} es''2.->-1)
  es''4.-3^\markup{\bold "Coda"}\p
  \bar "|."
}

lowerCard = {
  \clef bass
  \key es \major
  \time 12/8
  bes,8_\finger "(3)"-. <f es'> (<bes es' as'!>) bes,,-.\ped <f d'> (<bes d' as'>)\pes es,-.\ped <g es'> (<bes es' g'>)\pes   es-. <g es'> (<bes es' g'>)
  es,8_\finger "(3)"-.\ped s1*1/4
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
