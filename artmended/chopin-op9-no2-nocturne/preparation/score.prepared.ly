\version "2.26.0"
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

upper = {

       \clef treble
       \key es \major
       \time 12/8
	   
\override Score.MetronomeMark.transparent = ##t
\tempo 8=132
       \partial 8	
	   \chopinDynamicSpacing
\did
	   \once \override TextScript.extra-offset = #'( -5.0 . 2.0 )
	    bes'8-1^\markup{ \bold "Andante ( "\tiny \note {8} #1 \tiny "=132)"}
		
	   % bar 0
\once \override TextScript.extra-offset = #'( 0.0 . -4.8 )
	   g''4.^\markup { \finger "54" }~
	   
	   \once \override TextScript.extra-offset = #'( -14 . 0.0 )
	   g''8_\markup{\italic 
\normalsize "espress. dolce"} f''-3 (g''-4 f''4.-3 es''4-2) bes'8-1	%1
	( g''4-5 
\once \override TextScript.extra-offset = #'( 0.5 . -4.5 )
\dpp
	c''8\<\grc c'''4-5 \! g''8-2 bes''4.-4 as''4-3 g''8-2) 	%2

\dif f''4.-1 g''4-3 (d''8-1) es''4.-2 c''-1	%3
\did bes'8-1\f  ( \dif d'''-5)  c'''-4 (bes''16-3 as'' g'' as''-4) c'' (d'' es''4.) r4 bes'8-1	%4
	
( \once \override Script.extra-offset = #'(-0.3 . -1.8) g''4.\p^\markup { \finger "54" } f''16-3)  (g'' \sot f''\prall e'' f'' g'' f''8-.-3)   es''4->-2~(es''16 f'' es''\prall d'' es'' f''	%5 
	
\ddd g''-4)\< [b' (c'') des''->-3 (c''-1) \ttt f''->-2_\markup{\italic "cresc."} (e''-1) as''->-3 (g''-1) des'''-4 (c''') g'']\! \dpp bes''!4.-3\> ( \did as''4-2\! \dif g''8-1) %6

f''4.^\markup { \finger "23" }\startTrillSpan \grace { e''16\stopTrillSpan ([f''16] } g''8-.-3) g''-4 (d''-1) es''4.-2 (c''-1)	%7

\did bes'8-1\f ( \dif d'''-.-5) \ddd \did c'''-.-4\<  \( \did bes''16-.-3 [as''-. g''-.-1 as''-.  \once \override TextScript.extra-offset = #'( -0.5 . -3.4 ) \acciaccatura as''8^\qua c''16-1 d''\!]\)  es''4.-3~es''8 d''-2 es''	%8

f''4.-4\p \dif g''4-5\> (f''8)\! f''4.\pp (c''4.)	%9

\pri es''8-.-4\startTextSpan ([es''-.-3 es''-.-2] es''-.-1) [d''16-2 (es'' f''16.-4 es''32-3)] es''4.-2 (bes'-1)\stopTextSpan	%10

\did bes''-5\f\tei ( a''4-4 g''8-3) <a'^1 f''-5>4. <bes'^2 d''-4>	%11

 \did <g'^1 es''-5>4. ( <a'^2 d''-5>8-. <a' c''>-. <a' d''>-.)  <f'-1 bes'-3>-. (  <fis'_2  b'>-. ^\qua  <e'  b'>-.^\qua \pra <e' bes'-3 c''>-. <f' a'  c''>-.^\qua  < as'_2 d''>-.^\cin)	%12
 
\grace { \once \override DynamicLineSpanner.staff-padding = #3.3 g'16\sf\tei [(bes' es'']} g''4) \p a'16 (bes' ces''-- bes' \accidentalStyle forget cis''-4 \accidentalStyle default d''-1 g''16.-5) f''32-4 f''4-3 es''8->-2~ es''16 (f'' es''\prall d''-1 es'' f''	%13

g''-.) \ddd \dif b'-1\< (c''-2) des''-3 (c''-1) f''-2\! (\once \override TextScript.staff-padding = #2 e''-1_\markup { \italic "cresc." } ) as''-3 (g''-1) des''' (c''' g'' bes''!4.-3) (\ddd \did as''4-2\> \dif g''8-1\!)	%14

\once \override TextScript.extra-offset = #'( 0.5 . 0.0 )
f''4.\p^\markup { \column {\center-align {{\lower #0.5 \finger "23"} {\musicglyph "scripts.trill"}  } }}  \grace { e''16 ([f''] } g''8-.-3) \dif g''->-4 (d''-1) es'' 4.-2 c''-1	%15

\ddd 
\once \override TextScript.extra-offset = #'( 1.5 . 0.5 )
\did bes'8-1_\fpa\< (d''') cis'''-.-4 ( c'''32-.-5 b''-.-3 bes''-.-4 a''-.-5 as''-. f''-. d''-. ces''-.->) bes' d'' \tuplet 3/2  {\tupletUp \once \override TupletNumber.extra-offset = #'( 0.0 . 1.7 ) \once \override TupletBracket.extra-offset = #'( 0.0 . 1.7 ) g''-5  f''-4 es''-2\!} es''4.^\markup {  \finger "12" }~ es''8 d'' es''	%16

\dif f''4.-3\p (g''4-4 f''8) \did f''4.-4 (c''-1)	%17

<<{ \oneVoice \once \override TextScript.extra-offset = #'( 1.8 . -2.0 )
\tuplet 4/3  { \once \override PhrasingSlur.positions = #'(5.5 . 4) \dif es''8-.-3_\ppt \(  (  es''-. es''-. es''-.)} es'' (\did d''16-2 es'' f''16. es''32)\) es''4.   (\ddd bes'4.)} 
\\
{\voiceTwo s4. s4. s4. s8\<s8 s8\! } >>
	%18

\dif bes''4.-5\f (a''4 g''8) \ddd <a'^1 f''-5>4.\> (<bes'^2 d''-4>\!)	%19

 <g' es''>4.  \( \stemUp \once \override TextScript.extra-offset = #'( 0.0 . -2.2 ) <a' d''>8-.^\markup{\column {\center-align \lower #3 {\finger"5"}\center-align \lower #1.7 {\finger"2"}}} (\did <a' c''>-.^\markup{\column {\center-align \lower #3 {\finger"4"}\center-align \lower #1.7 {\finger"2"}}} <a' d''>-.) \)  \stemNeutral <f'^1 bes'-3>-. ( \once \override TextScript.extra-offset = #'( -2.0 . 0.0 ) <fis' b'>-.\prl <e' b'>-. <e' bes' c''>-. <f' a' c''>-. <as' d''>-.)	%20
 
\grace { \once \override DynamicLineSpanner.staff-padding = #3.3 g'16\sf\tei [(bes' es'']} g''4) \p a'16 (bes' ces''-> bes' \accidentalStyle forget cis'' \accidentalStyle default d''-1 \dif g''16.->-4 f''32) \ddd f''4\> ( es''8->-2\!)~ es''16 f'' (es''\trill \ddd d''\< es'' f''\!	%21

g'')  b'-1 (c''-2) des''->-3 (c''-1) f''->-2 (\ddd e''-1\<) as''->-3 (g''-1) des''' (c''' g'' \acciaccatura {g''8} bes''!4.)\!  (as''4 g''8-1)	%22


f''4.^\markup { \finger "23" }\startTrillSpan  \grace { e''16\stopTrillSpan ([f''] } g''8-.) g''-4 (d''-1) es'' 4.-2 (c''-1)	%23

\ddd 
\once \override TextScript.extra-offset = #'( 1.5 . 0.5 )
\did bes'16-1-._\fpa\< ([ \dif d'''8-5 \set stemLeftBeamCount = #1 \set stemRightBeamCount = #2  
 cis'''16-.-4  \set stemLeftBeamCount = #2 c'''16-.-5 b''32-.-4] bes''16-.-3 [a''-.-5]) as''32-!-4 \did a'-1 ( bes'-2 b'-1 c'' cis'' d''-1  \tuplet 3/2  {\tupletUp \once \override TupletNumber.extra-offset = #'( 0.0 . 1.5 ) \once \override TupletBracket.extra-offset = #'( 0.0 . 1.5 ) g''-4  f''-3 es''-2\!} es''2.->-1)	%24

es''4.-3^\markup{\bold "Coda"}\p (f''8 es'' f'' g''2.)	%25

es''4.\pp \(~es''16 f'' (es'') f'' ( es'' f'' g''4\pru) \) es''8-2\turn (es'''-.-5) (d'''-.-5 c'''-.-5)	%26

bes''4-4\spp \(a''!8-5  (as'') c'' d''\) es'' f''16 ( es''\prall d'' es'' ) \acciaccatura es''8 g'''8-.\dol f'''16-.-5 (es'''-.-4 d'''-.-5 c'''-.-5	%27 

ces'''8---5 bes''---4 beses''---5) \dif beses''16-5 ([as''-4]) as''-4 ([g''-5]) g''16.-5 (f''32-4 es''2.->-3)	%28 

es''4.\p~ \(\tuplet 8/6 {\tupletDown es''16 f'' (es'' f'' es'') \ddd f''  ( \< es'' f'')} g''4.\!\) r4 r8	%29

es''8-!_\markup{\italic 
\normalsize "con forza"} \did as'16-2 (bes' as'\trill g' as'-2 [ces''-1 es''-2 as''-3 es'''-5) r32 \dif f'''-3] (
\ottava #1
\did g'''8-4 es''') <es''' es''''>4-> \once \override TextScript.extra-offset = #'( -1.0 . 0.0 ) <d''' d''''>8_\markup{\italic 
\normalsize "stretto"} <c'''! c''''!>	%30

<ces''' ces''''-5> <bes'' bes'''-4> <beses'' beses'''-5> <as''! as'''!-4> <g'' g'''> <d'' d'''-5> <es'' es'''-4> <es''' es''''>4._> <f'' f'''>8 <c''' c''''>	%31

\cadenzaOn <ces''' ces''''>2.-^_\markup {\dynamic ff \italic 
\normalsize "senza        –          –        tempo" } s4 <bes'' bes'''>2.-^\fermata \tiny{ \ddd \stemUp \override DynamicLineSpanner.staff-padding = #2.0 ces''''!16-3\< [bes'''-2 c''''!-4 a'''!-1]  ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a''']    ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a''']   ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a'''] ces''''_\markup  {  \italic 
\normalsize "cresc." } [bes''' c''''! a'''\!] \bar "" ces'''' [bes''' c''''! a'''] ces'''' [bes''' c''''! a'''] \ddd ces''''\>_\markup {  \italic 
\normalsize "dimin." } [bes''' c''''! a'''\!]  ces'''' [bes''' c''''! a''']  ces''''  [bes''' d''''-5 c''''!-4] bes'''-2_\markup { \italic 
\normalsize "rallent. smorz." } [a'''-1 as'''-4 g'''-3] f'''-2 [d'''-1 (es'''-2 ces'''-1]
\ottava #0
bes''8-4 [ as'' c'' d''-3)]} \cadenzaOff \bar "|" \normalsize		%32
\stemNeutral  \once \override TextScript.extra-offset = #'( 0.0 . -2.0 ) <g' es''-4>8_\markup{\dynamic pp} (\once \override TextScript.extra-offset = #'( -3.0 . 0.0 ) bes'-2\tei g''  <g' es''> bes' g'' <g' es''> bes' g'' <g' es''> bes' g''	%33
 \once \override TextScript.extra-offset = #'( 0.0 . -2.0 ) <g' es''>4._\markup{\dynamic ppp}) <g'' es'''> <g es'>2.\fermata \bar "|."	%34


   
	
     
}
lower = {

       \clef bass
       \key es \major
       \time 12/8
     \override Beam.auto-knee-gap = #3
       \partial 8 r8 % bar 0	
	   
 
es,-.\ped  <g es'>  ( <bes es'  g'>)\pes  es-.\ped <as d'> (<ces' d' as'>)\pes  es,-.\ped <g es'> (<bes es' g'>)\pes d,-.\ped  <g es'> (<bes es' g'>)\pes	%1
	   
c,-.\ped <g e'> (<bes e' g'>)\pes   c-.\ped <g e'> (<c' e' bes'>)\pes f,-.\ped <f des'> (<bes des' e'!>)\pes  f,-.\ped <f c'> (<as c' f'>)\pes	%2
	   
bes,-.\ped <f d'!> (<bes d' as'>)\pes b,-.\ped <g f'> (<d' f' g'>)\pes c-.\ped <g es'> (<c' es' g'>)\pes a,-.\ped <ges es'> (<c' es' ges'>)\pes	%3
		
bes,-.\ped <f es'> (<bes es' as'!>)\pes   bes,,-.\ped  <f d'> (<bes as'>)\pes  es,-.\ped   <g es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)	%4
		
es-. <g es'>  (<bes es' g'>)\pes \once \override TextScript.extra-offset = #'( 0.0 . 3.0 ) es-.\ped <as d'> (<ces' d' as'>)\pes es-.\ped <g es'> (<bes es' g'>)\pes \once \override TextScript.extra-offset = #'(0.0 . 2.0 )d-.\ped <g es'> (<bes es' g'>)\pes %5
		
c-.\ped <g e'> (<bes e' g'>) c-. <g e'> (<c' e' bes'>)\pes f,-.\ped <f des'> (\once \override TextScript.extra-offset = #'( 0.0 . 2.0 ) <bes des' e'!>)\pes \once \override TextScript.extra-offset = #'( 0.0 . 3.0 ) f,-.\ped <f c'> ( \once \override TextScript.extra-offset = #'( 0.0 . 2.0 ) <as c' f'>)\pes	%6
		
 bes,-.\ped <f d'!> (<bes d' as'>\pes) b,-.\ped <g f'> (<d' f' g'>)\pes c-.\ped <g es'> (<c' es' g'>)\pes a,-.\ped <ges es'> (<c' es' ges'>)\pes	%7
		
bes,-.\ped <f es'> (<bes es' as'!>)\pes  bes,,-.\ped <f d'> (<bes as'>)\pes  es,-.\ped  <g es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)\pes	%8
		
bes,-.\ped <f d'> (<bes d' f'>) bes,-. <f d'> (<bes d' f'>)\pes a,-.\ped <f c'> (<c' f'>) a,-. <f c'> (<c' f'>)\pes	%9
		
as,!-.\ped <es c'> (<as c' es'>) as,,-. <es ces'> (<as ces' es'>)\pes es,-.\ped  <g es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)\pes %10

e,-.\ped <e des'> (<bes des' g'>)\pes e,-.\ped <e c'> (<bes c' g'>)\pes f,-.\ped <f es'!> (<c' es' f'>)\pes g,-.\ped <g d'!> (<bes d' g'>)\pes	%11

c,-.\ped <g es'> (<c' es' g'>)\pes f,-.\ped <f es'> (<c' es' f'>)\pes <bes d'>-. (<a dis'>-. gis-. g-. <f c' es'!>-. <bes f'>-.)	%12

es,-.\ped <g es'> (<bes es' g'>)\pes es-. <as d'> (<bes d' as'>) es-. <g es'> (<bes g'>) d-. <g es'> (<bes es' g'>)	%13

c-. <g e'> (<bes e' g'>) c-. <g e'> (<c' e' bes'>) f,-. <f des'> (<bes des' e'!>) f,-. <f c'> (<as c' f'>)	%14

bes,-.\ped <f d'!> (<bes d' as'>)\pes b,-.\ped <g f'>  (<d' f' g'>)\pes c-.\ped <g es'> (<c' es' g'>)\pes a,-.\ped <ges es'> (<c' es' ges'>)\pes	%15

bes,-. <f es'> (<bes es' as'!>) bes,,-.\ped <f d'>\pes (<bes d' as'>) es,-.\ped <g es'> (<bes g'>)\pes   es-. <g es'> (<bes g'>)	%16

bes,-. <f d'> (<bes d' f'>) bes,-. <f d'> (<bes d' f'>) a,-. <f c'> (<c' f'>) a,-. <f c'> (<c' f'>)	%17

as,!-. <es c'> (<as c' es'>)	as,,-.\ped <es ces'> (<as ces' es'>)\pes es,-. <g es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)	%18

e,-.\ped <e! des'> (<bes des' g'>)\pes e,-. <e c'> (<bes c' g'>) f,-.\ped <f es'!> (<c' es' a'>)\pes g,-.\ped <g d'> (<bes d' bes'>)\pes	%19

c,-.\ped <g es'> (<c' es' g'>)\pes f,-. <f es'> (<c' es' f'>) <bes d'>-. (<a dis'>-. gis-. g-. <f c' es'!>-. <bes f'>-.)	%20

es,-.\ped <g es'> (<bes es' g'>)\pes es-. <as d'> (<bes d' as'>) es-. <g es'> (<bes es' g'>) d-. <g es'> (<bes es' g'>)	%21

c-. <g e'> (<bes e' g'>) c-. <g e'> (<c' e' bes'>) f,-. <f bes des'> (<bes des' e'!>) f,-. <f c'> (<as c' f'>)	%22

bes,-. <f d'!> (<bes d' as'>) b,-. <g f'>  (<d' f' g'>) c-. <g es'> (<c' es' g'>) a,-. <ges es'> (<c' es' ges'>)	%23

bes,-. <f es'> (<bes es' as'!>) bes,,-.\ped <f d'> (<bes d' as'>)\pes es,-.\ped <g es'> (<bes es' g'>)\pes   es-. <g es'> (<bes es' g'>)	%24

es,-.\ped <as ces' es'> (<ces' es' as'>) es-. <as ces' es'> (<ces' es' as'>)\pes es,-.\ped <g es'> (<bes es' g'>)  es-. <g es'> (<bes es' g'>)\pes	%25

es,-.\ped <as ces' es'> (<ces' es' as'>) es-. <as ces' es'> (<ces' es' as'>)\pes es,-.\ped <g bes es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)\pes	%26

es-.\ped <f d'> (<bes as'!>) es-. <f d'> (<bes as'>)\pes es-.\ped <g es'> (<bes g'>)\pes a,-.\ped <f es'> (<c' es' f'>)\pes	%27

bes,-.\ped <f es'> (<bes es' as'!>)\pes bes,,-.\ped <f d'> (<bes d' as'>)\pes es,-.\ped <g es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)\pes 	%28

as,,-.\ped <es as ces'> <as ces' es'> <ces' es' as'> <as ces' es'> <es as ces'>\pes es,-.\ped <g es'> (<bes es' g'>) es-. <g es'> (<bes es' g'>)\pes	%29

as,,-.\ped <es as ces'> <as ces' es'> <es as ces'> <as ces' es'> <es as ces'> es,-.\ped <g es'> (<bes es' g'>)\pes a,\ped <f es'> <ces' es' f'>\pes	%30

bes,-.\ped <f bes es'> (<bes es' as'!>)\pes b,-.\ped <g f'> (<d' f' g'>)\pes c-. <g es'> (<c' g'>) a,-.\ped
<<{ \oneVoice \stemUp <c' es'>8  <c' es' f'>\pes }
\\
{ \voiceTwo  f4} >>	%31

\cadenzaOn \once \override PhrasingSlur.positions = #'(3 . 5) \stemDown bes,,8\ped [ \(\once \override TextScript.extra-offset = #'( -0.4 . -5.5 ) bes,^\markup { \finger "15" } \did \once \override TextScript.extra-offset = #'( 0.0 . -4.0 ) f^\tre \dif as!-2   d'-1 \did bes-5
       \clef treble
\once \override TextScript.extra-offset = #'( 0.0 . -6.0 ) f'^\tre \once \override TextScript.extra-offset = #'( 0.0 . -5.0 ) as']^\due\)  d''2.-1\fermata
       \clef bass
s1  s s s s8 s\pes  \cadenzaOff \bar "|"	%32

<< {  \oneVoice \stemUp 
s8  bes4  s8 bes4 s8 bes4 s8 bes4~
 } \\ {  \voiceTwo  \stemDown \slurUp \once \override Slur.extra-offset = #'(0.0 . 2.5) \once \override Slur.positions = #'(-1.0 . -1.0) es,8^.\ped  ( bes bes, es8 bes bes,) \once \override Slur.extra-offset = #'(0.0 . 1.0) \once \override Slur.positions = #'(0.0 . 0.5) es,^. (bes bes, es bes bes,
 } >> %33
<< { \stemNeutral
<es bes>4.)

 } \\ { bes4 s8 )\stemNeutral
\clef treble
<es' bes'>4.
\clef bass
 \once \override TextScript.extra-offset = #'( 3.0 . 1.5 ) <es, bes,>2.\pes^\fermata

 } >> %34

}
\score { \new PianoStaff << \new Staff = "upper" \upper \new Staff = "lower" \lower >> \layout {} }
