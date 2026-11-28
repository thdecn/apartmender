\version "2.26.0"
#(set-global-staff-size 25)
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
  \key e \minor
  \time 2/2
  \mark \markup { \box \bold "m. 16" }
  << { b'8.^\finger "(3)" ais'16 ais'4  \posScriptA \posAccidental gisis''4\turn\> fis''8. e''16\! } \\ { s16\< s s s s s\! s s } \\ { \set decrescendoText = \markup { \italic stretto } \set decrescendoSpanner = #'text s4 s8^\> s8 s2\! } >>
  << { e''8^\finger "(3)"\f\< s1*7/8 } \\ { s1 } \\ { s4 s1*3/4 } >>
  \bar "|."
}

lowerCard = {
  \set Staff.pedalSustainStyle = #'bracket
  \clef bass
  \key e \minor
  \time 2/2
  <e g d'>8_\finger "(531)" <e g d'> <e g cis'> <e g cis'> <cis e ais> <cis e ais> <c e a> <c e a> |
  <b,, b,>8_\finger "(51)"\)\sustainOn s1*7/8
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    \context { \PianoStaff \consists #Span_stem_engraver }
    ragged-right = ##f
    system-count = 1
  }
}
