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
  \mark \markup { \box \bold "m. 59" }
  g''8^\finger "(5)"\mp(
e''8)
c''4.(
d''16
e''16
d''8
c''8)
  \acciaccatura d''8^\finger "(3)"
c''8.\trill-3
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  e'16->_3
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
  f'16-2\mp s1*1/8
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
