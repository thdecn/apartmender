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
  \mark \markup { \box \bold "m. 13" }
  r1
  d'''8^\finger "(5)"\mp
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  cis'16->\p-2(
d'16
cis'16
d'16
cis'16
d'16
cis'16
d'16
c'16_2->
d'16
c'16
d'16
c'16
d'16
c'16
d'16)
  b16->_3 s1*1/16
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
