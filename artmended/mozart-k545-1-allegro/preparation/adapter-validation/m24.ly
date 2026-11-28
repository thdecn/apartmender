\version "2.26.0"
#(set-global-staff-size 25)

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
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 24" }
  b''8-3(\f
g''8-1)
d'''2-5(\sf
c'''16
b''16
a''16
g''16)
  \override PhrasingSlur.direction = #-1

\acciaccatura b''8-3
\afterGrace 15/16 a''1\startTrillSpan\(( { g''16[ a''16])\stopTrillSpan }
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  d'16_5
b'16_1
g'16_2
b'16
d'16
b'16
g'16
b'16
d'16
b'16
g'16
b'16
d'16
b'16
g'16
b'16
  d'16 s1*15/16
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
