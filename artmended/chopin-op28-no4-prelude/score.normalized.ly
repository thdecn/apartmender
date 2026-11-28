\version "2.26.0"
\language "nederlands"
barRest =  {\skip 2 |}

paperOFF = { \set Score.skipTypesetting = ##t }
paperON = { \set Score.skipTypesetting = ##f }

hidePP = \tweak #'stencil ##f \pp
ppWhiteOut = \markup { \whiteout { \dynamic "pp" } }

posBeamA = \once \override Beam.damping = #2

shpSlurA = \shape #'( ((0 . -0.3) (8 . 0.5) (0 . 1) (0 . 0))
                      ((0 . 0) (0 . 0) (-3 . -0.7) (0 . -0.7)) ) PhrasingSlur
shpSlurB = \shape #'((0 . 2.8) (0 . 1) (0 . -0.6) (0 . 0)) PhrasingSlur
shpSlurC = \shape #'( ((0.8 . 0) (0.8 . 0) (0 . 0) (0 . 0))
                      ((0 . -0.5) (0 . -0.5) (-1 . 1) (-0.5 . 2)) ) PhrasingSlur
shpSlurD = \shape #'( ((0.3 . 0) (3 . 1) (-3 . 1) (0 . 0))
                      ((0 . 0) (0 . 0.3) (0 . 0.8) (0 . -0.7)) ) PhrasingSlur

shpSlurE = \shape #'((0 . 1) (0 . 0.6) (0 . 0.5) (0 . 0)) PhrasingSlur

posScriptA = \once \override Script.extra-offset = #'(-3 . 0)
posScriptB = \once \override TextScript.extra-offset = #'(-1.8 . -2.6)
posAccidental = \once \override Staff.AccidentalPlacement.right-padding = #1.5


upper = {
\clef treble
    \time 2/2
    \key e \minor

                                
    \phrasingSlurUp
    \tempo "Largo" \partial 4 \posBeamA \shpSlurA b8.\(\p b'16_\markup{ \italic \whiteout "espressivo"} | % bar 0
b'2. c''4 | % bar 1
b'2. c''4 | % bar 2
b'2. c''4 | % bar 3
b'2. bes'4 | % bar 4
a'2. b'!4 | % bar 5
a'2. b'4 | % bar 6
a'2. b'8. a'16 | % bar 7
a'2.\)
    \shpSlurB
    gis'4->\(~ | % bar 8
<< { gis'4 a'8 b' d''8\> c'' e' a'\! } \\ { s4 s32\< s s s s s s s\! } >> | % bar 9
fis'2.\) a'4( | % bar 10
fis'2.) \acciaccatura b'8 \shpSlurC a'4_\( | % bar 11
g'!8 fis' c'\<^> b dis' fis'\! \tuplet 3/2 {d''\> c'' b'\!} | % bar 12
\shpSlurD b'2.\p\)\( c''4 | % bar 13
b'2. c''4 | % bar 14
b'2. c''4 | % bar 15
<< {   b'8. ais'16 ais'4  \posScriptA \posAccidental gisis''4\turn\> fis''8. e''16\! } \\ {  s16\< s s s s s\! s s  }  \\ { \set decrescendoText = \markup { \italic stretto } \set decrescendoSpanner = #'text s4 s8^\> s8 s2 } >> | % bar 16
<< { e''8\f\< dis'' c''' dis''\! dis''\> e'' g'' b' } \\ { s1 } \\ { s4 s4 s4 s4 } >> | % bar 17
<< { \stemUp
    d''!8 c''8 \tupletDown \tuplet 3/2 {e'' e' a'\! } fis'4._\markup{ \italic "dim." } a'8 } \\ { s1 } \\ { s4 s4 s4\! s4 } >> | % bar 18
\stemNeutral
    fis'2.\p\) \acciaccatura b'8 a'4\( | % bar 19
fis'2.~ fis'8.\< e'16\! | % bar 20
e'2._\markup{\italic smorz.}\> fis'4 | % bar 21
e'2.\! fis'4 | % bar 22
e'2\) r\fermata | % bar 23
<< {  
         \posScriptB \shpSlurE e'2^\(-\hidePP_\ppWhiteOut dis'  } \\ { 
         \change Staff = "lower" \stemUp
         \crossStaff { <fis b e>2 <b dis fis> }  } >> | % bar 24
<< {  e'1\)\fermata
        } \\ { \change Staff = "lower" \stemUp  <g b e>1
     } >> | % bar 25
}

lower = {
\clef bass
    \time 2/2
    \key e \minor
                                
    \partial 4 r4 | % bar 0
<g b e'>8\sustainOn\(-\hidePP <g b e'>8 <g b e'>8 <g b e'>8 <g b e'>8 <g b e'>8 <g b e'>8\sustainOff <g b e'>8 | % bar 1
<fis a e'>\sustainOn <fis a e'> <fis a e'> <fis a e'>\sustainOff <fis a dis'>\sustainOn <fis a dis'> <fis a dis'> <fis a dis'>\sustainOff | % bar 2
<f a dis'>\sustainOn <f a dis'> <f a dis'> <f a dis'>\sustainOff <f a d'> <f a d'> <f gis d'> <f gis d'> | % bar 3
<e gis d'>\sustainOn <e gis d'> <e gis d'> <e gis d'>\sustainOff <e g d'> <e g d'> <e g cis'> <e g cis'> | % bar 4
<e g c'>\sustainOn <e g c'> <e g c'> <e g c'>\sustainOff <e fis c'> <e fis c'> <e fis c'> <e fis c'> | % bar 5
<e fis c'>\sustainOn <e fis c'> <e fis c'> <e fis c'>\sustainOff <dis fis c'>\sustainOn <dis fis c'> <dis fis c'> <dis fis c'>\sustainOff | % bar 6
<d fis c'>\sustainOn <d fis c'> <d fis c'> <d fis c'> <d fis c'> <d fis c'> <d fis c'>\sustainOff <d fis c'> | % bar 7
<d f c'>\sustainOn <d f c'> <d f c'> <d f c'>\sustainOff <d f b> <d f b> <d f b> <d f b> | % bar 8
<c e b> <c e b> <c e a> <c e a> <c e a> <c e a> <c e a> <c e a> | % bar 9
<b, e a> <b, e a> <b, dis a> <b, dis a> <c e a>\sustainOn <c e a> <c e a> <c e a>\sustainOff | % bar 10
<b, dis a>\sustainOn <b, dis a> <b, dis a> <b, dis a>\sustainOff <c e a>\sustainOn <c e a> <c e a> <c e a>\sustainOff | % bar 11
<b, dis a>4\) r r2 | % bar 12
<g b e'>8\sustainOn\( <g b e'>8 <g b e'>8 <g b e'>8 <g b e'>8 <g b e'>8 <g b e'>8\sustainOff <g b e'>8 | % bar 13
<fis a e'>\sustainOn <fis a e'> <fis a e'> <fis a e'>\sustainOff <f a dis'>\sustainOn <f a dis'> <f a dis'> <f a dis'>\sustainOff | % bar 14
<f gis dis'> <f gis dis'> <f gis d'> <f gis d'> <e gis d'>\sustainOn <e gis d'> <e gis d'> <e gis d'>\sustainOff | % bar 15
<e g d'> <e g d'> <e g cis'> <e g cis'> <cis e ais> <cis e ais> <c e a> <c e a> | % bar 16
<b,, b,>\)\sustainOn <a c' fis' a'>\( <a c' fis' a'> <a c' fis' a'>\sustainOff <g b dis' fis'> <g b e'> <g b e'> <g b e'> | % bar 17
\override Staff.PianoPedalBracket.shorten-pair = #'(0 . -2.0)
    <a c' e'>[ <a c' e'>] a,\sustainOn <e fis c'>\sustainOff <b, e b> <b, e b> <c e a> <c e a> | % bar 18
\revert Staff.PianoPedalBracket.shorten-pair
    <b, e b>\sustainOn <b, e b> <b, e b> <b, e b>\sustainOff <c e a> <c e a> <c e a> <c e a> | % bar 19
<b, e b>\sustainOn <b, e b> <b, e b> <b, e b>\sustainOff <b, dis b>\sustainOn <b, dis b> <b, dis a> <b, dis a>\sustainOff | % bar 20
<c g>\sustainOn <c g> <c g> <c g> <c bes> <c bes> <c e a>\sustainOff <c e a> | % bar 21
<b, e a> <b, e a> <b, e gis> <b, e gis> <b, e g>\sustainOn <b, e g> <b, e g> <b, e g>\sustainOff | % bar 22
<bes, c g>2\) r\fermata | % bar 23
\stemDown <b,,! b,!>2_( <b,, b,fis,> | % bar 24
<e,, e,>1)_\fermata | % bar 25
}
\score { \new PianoStaff << \new Staff = "upper" \upper \new Staff = "lower" \lower >> \layout { \context { \PianoStaff \consists #Span_stem_engraver } } }
