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
