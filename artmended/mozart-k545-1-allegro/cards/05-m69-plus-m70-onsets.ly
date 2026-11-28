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
  \mark \markup { \box \bold "m. 69" }
  g''8-1\f(
a''16
b''16
c'''16-1
d'''16
e'''16
d'''16
c'''16
b''16-4
a''16
g''16
f''16
e''16-3
d''16
c''16)
  \override PhrasingSlur.direction = #-1

\acciaccatura e''8-3
\afterGrace 15/16 d''1\startTrillSpan\(( { c''16[ d''16])\stopTrillSpan }
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  g16-5
e'16
c'16-2
e'16
g16-5
e'16
c'16-2
e'16
g16-5
e'16
c'16-2
e'16
g16-5
e'16
c'16-2
e'16
  g16_\finger "(5)" s1*15/16
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
