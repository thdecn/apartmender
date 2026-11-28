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
  \mark \markup { \box \bold "m. 58" }
  r1
  g''8^\finger "(5)"\mp
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  \clef "treble"

fis'16->\p-2(
g'16
fis'16
g'16
fis'16
g'16
fis'16
g'16
f'16_2->
g'16
f'16
g'16
f'16
g'16
f'16
g'16)
  e'16->_3 s1*1/16
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
